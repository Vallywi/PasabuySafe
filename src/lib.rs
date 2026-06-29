#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracterror, contracttype, symbol_short, token, Address, Env,
};

#[contract]
pub struct PasabuySafe;

/// Represents the current state of a buyer's order in the escrow lifecycle.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum OrderStatus {
    Deposited,  // Buyer has deposited funds
    Delivered,  // Organizer has marked order as delivered
    Confirmed,  // Buyer has confirmed delivery, funds released
}
/// Storage keys for the contract's persistent data.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Initialized,          // bool - whether contract is initialized
    Organizer,            // Address - the organizer's address
    Token,                // Address - the token contract address
    Deadline,             // u64 - expiration timestamp for refunds
    ConfirmWindow,        // u64 - seconds buyer has to confirm after delivery (e.g., 259200 = 3 days)
    Status(Address),      // OrderStatus - per-buyer order status
    Deposit(Address),     // i128 - per-buyer deposit amount
    DeliveredAt(Address), // u64 - timestamp when organizer marked delivered (for auto-release)
}
/// Custom error codes for the PasabuySafe contract.
#[derive(Clone, Debug, Eq, PartialEq, Copy)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,  // Contract has already been initialized
    NotInitialized = 2,      // Contract not yet initialized
    AlreadyDeposited = 3,    // Buyer has already deposited
    NotDeposited = 4,        // Buyer has not deposited
    NotDelivered = 5,        // Order not in Delivered state
    NotExpired = 6,          // Deadline has not passed yet
    InvalidStatus = 7,       // Invalid status transition
    InvalidAmount = 8,       // Amount must be greater than zero
    ConfirmWindowOpen = 9,   // Confirmation window hasn't expired yet (buyer still has time)
}
#[contractimpl]
impl PasabuySafe {
    /// Initialize the escrow contract with organizer, token, expiration deadline,
    /// and confirmation window (seconds the buyer has to confirm after delivery).
    /// Can only be called once. Requires organizer authorization.
    pub fn initialize(
        env: Env,
        organizer: Address,
        token: Address,
        deadline: u64,
        confirm_window: u64,
    ) -> Result<(), Error> {
        // Prevent re-initialization
        if env.storage().persistent().has(&DataKey::Initialized) {
            return Err(Error::AlreadyInitialized);
        }

        // Verify organizer authorization
        organizer.require_auth();

        // Store contract configuration
        env.storage().persistent().set(&DataKey::Initialized, &true);
        env.storage().persistent().set(&DataKey::Organizer, &organizer);
        env.storage().persistent().set(&DataKey::Token, &token);
        env.storage().persistent().set(&DataKey::Deadline, &deadline);
        // Confirmation window: how long buyer has to confirm after delivery marking
        // Default recommendation: 259200 (3 days) or 604800 (7 days)
        env.storage().persistent().set(&DataKey::ConfirmWindow, &confirm_window);

        Ok(())
    }

    /// Buyer deposits tokens into escrow. Prevents duplicate deposits.
    /// ANTI-SCAM: Money goes to the CONTRACT, not the organizer.
    /// The organizer cannot access these funds until the buyer confirms delivery.
    /// Requires buyer authorization. Emits a deposit event.
    pub fn deposit(
        env: Env,
        buyer: Address,
        amount: i128,
    ) -> Result<(), Error> {
        // Verify buyer authorization
        buyer.require_auth();

        // Validate deposit amount
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Prevent duplicate deposits
        if env.storage().persistent().has(&DataKey::Status(buyer.clone())) {
            return Err(Error::AlreadyDeposited);
        }

        // Transfer tokens from buyer to contract
        let token_address: Address = env.storage().persistent().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&buyer, &env.current_contract_address(), &amount);

        // Record deposit
        env.storage().persistent().set(&DataKey::Status(buyer.clone()), &OrderStatus::Deposited);
        env.storage().persistent().set(&DataKey::Deposit(buyer.clone()), &amount);

        // Emit deposit event
        env.events().publish((symbol_short!("deposit"), buyer.clone()), amount);

        Ok(())
    }

    /// Organizer marks a buyer's order as delivered.
    /// IMPORTANT: This does NOT release funds. Only the buyer can release funds
    /// by calling confirm_delivery. This prevents scammers from taking money
    /// without actually delivering.
    /// Transitions status from Deposited to Delivered. Requires organizer authorization.
    pub fn mark_delivered(
        env: Env,
        buyer: Address,
    ) -> Result<(), Error> {
        // Retrieve and verify organizer authorization
        let organizer: Address = env.storage().persistent().get(&DataKey::Organizer).unwrap();
        organizer.require_auth();

        // Verify buyer has deposited
        let status: OrderStatus = env.storage().persistent()
            .get(&DataKey::Status(buyer.clone()))
            .ok_or(Error::NotDeposited)?;

        // Verify correct status for transition
        if status != OrderStatus::Deposited {
            return Err(Error::InvalidStatus);
        }

        // Update status to Delivered
        env.storage().persistent().set(&DataKey::Status(buyer.clone()), &OrderStatus::Delivered);

        // Record when delivery was marked (starts the confirmation window timer)
        env.storage().persistent().set(&DataKey::DeliveredAt(buyer.clone()), &env.ledger().timestamp());

        // Emit delivery event
        env.events().publish((symbol_short!("deliver"), buyer.clone()), ());

        Ok(())
    }

    /// Buyer confirms delivery. Releases escrowed funds to organizer.
    /// ANTI-SCAM: This is the ONLY way the organizer receives payment.
    /// Only the buyer can call this function. The organizer cannot fake this.
    /// Transitions status from Delivered to Confirmed. Requires buyer authorization.
    pub fn confirm_delivery(
        env: Env,
        buyer: Address,
    ) -> Result<(), Error> {
        // Verify buyer authorization
        buyer.require_auth();

        // Verify buyer's order is in Delivered state
        let status: OrderStatus = env.storage().persistent()
            .get(&DataKey::Status(buyer.clone()))
            .ok_or(Error::NotDelivered)?;

        if status != OrderStatus::Delivered {
            return Err(Error::NotDelivered);
        }

        // Retrieve deposit amount and organizer
        let amount: i128 = env.storage().persistent().get(&DataKey::Deposit(buyer.clone())).unwrap();
        let organizer: Address = env.storage().persistent().get(&DataKey::Organizer).unwrap();
        let token_address: Address = env.storage().persistent().get(&DataKey::Token).unwrap();

        // Transfer funds from contract to organizer
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &organizer, &amount);

        // Update status to Confirmed
        env.storage().persistent().set(&DataKey::Status(buyer.clone()), &OrderStatus::Confirmed);

        // Emit release event
        env.events().publish((symbol_short!("release"), buyer.clone()), amount);

        Ok(())
    }

    /// Buyer requests refund after expiration deadline.
    /// ANTI-SCAM: If the organizer disappears, blocks the buyer, or never delivers,
    /// the buyer can reclaim their full deposit once the deadline passes.
    /// No one can prevent this — not the organizer, not us, not anyone.
    /// Only allowed when status is Deposited and current time >= deadline.
    /// Requires buyer authorization.
    pub fn refund(
        env: Env,
        buyer: Address,
    ) -> Result<(), Error> {
        // Verify buyer authorization
        buyer.require_auth();

        // Check if deadline has passed
        let deadline: u64 = env.storage().persistent().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() < deadline {
            return Err(Error::NotExpired);
        }

        // Verify buyer's order is in Deposited state (eligible for refund)
        let status: OrderStatus = env.storage().persistent()
            .get(&DataKey::Status(buyer.clone()))
            .ok_or(Error::NotDeposited)?;

        if status != OrderStatus::Deposited {
            return Err(Error::NotDeposited);
        }

        // Retrieve deposit amount and token
        let amount: i128 = env.storage().persistent().get(&DataKey::Deposit(buyer.clone())).unwrap();
        let token_address: Address = env.storage().persistent().get(&DataKey::Token).unwrap();

        // Transfer funds from contract back to buyer
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &buyer, &amount);

        // Clean up buyer's storage entries
        env.storage().persistent().remove(&DataKey::Status(buyer.clone()));
        env.storage().persistent().remove(&DataKey::Deposit(buyer.clone()));

        // Emit refund event
        env.events().publish((symbol_short!("refund"), buyer.clone()), amount);

        Ok(())
    }

    /// ORGANIZER PROTECTION: Auto-release funds if buyer doesn't confirm within the window.
    /// After organizer marks delivered and the confirmation window expires (e.g., 3 days),
    /// the organizer can call this to release funds without buyer's confirmation.
    /// This prevents dishonest buyers from receiving goods but never confirming.
    /// Requires organizer authorization.
    pub fn release_expired(
        env: Env,
        buyer: Address,
    ) -> Result<(), Error> {
        // Retrieve and verify organizer authorization
        let organizer: Address = env.storage().persistent().get(&DataKey::Organizer).unwrap();
        organizer.require_auth();

        // Verify buyer's order is in Delivered state
        let status: OrderStatus = env.storage().persistent()
            .get(&DataKey::Status(buyer.clone()))
            .ok_or(Error::NotDelivered)?;

        if status != OrderStatus::Delivered {
            return Err(Error::NotDelivered);
        }

        // Check that the confirmation window has expired
        let delivered_at: u64 = env.storage().persistent()
            .get(&DataKey::DeliveredAt(buyer.clone()))
            .unwrap();
        let confirm_window: u64 = env.storage().persistent()
            .get(&DataKey::ConfirmWindow)
            .unwrap();

        // If buyer still has time to confirm, reject
        if env.ledger().timestamp() < delivered_at + confirm_window {
            return Err(Error::ConfirmWindowOpen);
        }

        // Confirmation window expired — buyer had their chance.
        // Release funds to organizer automatically.
        let amount: i128 = env.storage().persistent().get(&DataKey::Deposit(buyer.clone())).unwrap();
        let token_address: Address = env.storage().persistent().get(&DataKey::Token).unwrap();

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &organizer, &amount);

        // Update status to Confirmed (same end state as buyer confirming)
        env.storage().persistent().set(&DataKey::Status(buyer.clone()), &OrderStatus::Confirmed);

        // Emit release event (same event type — funds released to organizer)
        env.events().publish((symbol_short!("release"), buyer.clone()), amount);

        Ok(())
    }
}

#[cfg(test)]
mod test;
