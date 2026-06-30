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
/// Each pasabuy is identified by a unique u64 ID (auto-incrementing).
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                          // Address - platform admin (set once at initialize)
    Token,                          // Address - the XLM SAC token (shared across all pasabuys)
    NextPasabuyId,                  // u64 - auto-increment counter
    PasabuyOrganizer(u64),          // Address - organizer for a specific pasabuy
    PasabuyDeadline(u64),           // u64 - deadline timestamp for a specific pasabuy
    PasabuyConfirmWindow(u64),      // u64 - confirm window (seconds) for a specific pasabuy
    BuyerStatus(u64, Address),      // OrderStatus - per buyer per pasabuy
    BuyerDeposit(u64, Address),     // i128 - per buyer per pasabuy
    DeliveredAt(u64, Address),      // u64 - timestamp when marked delivered
}

/// Custom error codes for the PasabuySafe contract.
#[derive(Clone, Debug, Eq, PartialEq, Copy)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,  // Contract has already been initialized
    NotInitialized = 2,      // Contract not yet initialized
    AlreadyDeposited = 3,    // Buyer has already deposited for this pasabuy
    NotDeposited = 4,        // Buyer has not deposited for this pasabuy
    NotDelivered = 5,        // Order not in Delivered state
    NotExpired = 6,          // Deadline has not passed yet
    InvalidStatus = 7,       // Invalid status transition
    InvalidAmount = 8,       // Amount must be greater than zero
    ConfirmWindowOpen = 9,   // Confirmation window hasn't expired yet
    PasabuyNotFound = 10,    // Pasabuy ID does not exist
}

#[contractimpl]
impl PasabuySafe {
    /// Initialize the platform contract. Sets the admin and token address.
    /// Called ONCE. The admin is reserved for future dispute resolution.
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
    ) -> Result<(), Error> {
        // Prevent re-initialization
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        // Verify admin authorization
        admin.require_auth();

        // Store platform configuration
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::Token, &token);
        env.storage().persistent().set(&DataKey::NextPasabuyId, &0u64);

        Ok(())
    }

    /// Create a new pasabuy. Anyone can call this to become an organizer.
    /// Requires the organizer's auth so no one can impersonate them.
    /// Returns the new pasabuy_id.
    pub fn create_pasabuy(
        env: Env,
        organizer: Address,
        deadline: u64,
        confirm_window: u64,
    ) -> Result<u64, Error> {
        // Ensure contract is initialized
        if !env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        // Verify organizer authorization
        organizer.require_auth();

        // Get and increment the pasabuy counter
        let pasabuy_id: u64 = env.storage().persistent()
            .get(&DataKey::NextPasabuyId)
            .unwrap_or(0u64);
        env.storage().persistent().set(&DataKey::NextPasabuyId, &(pasabuy_id + 1));

        // Store pasabuy configuration
        env.storage().persistent().set(&DataKey::PasabuyOrganizer(pasabuy_id), &organizer);
        env.storage().persistent().set(&DataKey::PasabuyDeadline(pasabuy_id), &deadline);
        env.storage().persistent().set(&DataKey::PasabuyConfirmWindow(pasabuy_id), &confirm_window);

        // Emit create event
        env.events().publish((symbol_short!("create"), pasabuy_id, organizer.clone()), ());

        Ok(pasabuy_id)
    }

    /// Buyer deposits tokens into escrow for a specific pasabuy.
    /// Prevents duplicate deposits per pasabuy. Money goes to the CONTRACT.
    /// Requires buyer authorization. Emits a deposit event.
    pub fn deposit(
        env: Env,
        pasabuy_id: u64,
        buyer: Address,
        amount: i128,
    ) -> Result<(), Error> {
        // Ensure contract is initialized
        if !env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        // Ensure pasabuy exists
        if !env.storage().persistent().has(&DataKey::PasabuyOrganizer(pasabuy_id)) {
            return Err(Error::PasabuyNotFound);
        }

        // Verify buyer authorization
        buyer.require_auth();

        // Validate deposit amount
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Prevent duplicate deposits for this pasabuy
        if env.storage().persistent().has(&DataKey::BuyerStatus(pasabuy_id, buyer.clone())) {
            return Err(Error::AlreadyDeposited);
        }

        // Transfer tokens from buyer to contract
        let token_address: Address = env.storage().persistent().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&buyer, &env.current_contract_address(), &amount);

        // Record deposit
        env.storage().persistent().set(
            &DataKey::BuyerStatus(pasabuy_id, buyer.clone()),
            &OrderStatus::Deposited,
        );
        env.storage().persistent().set(
            &DataKey::BuyerDeposit(pasabuy_id, buyer.clone()),
            &amount,
        );

        // Emit deposit event
        env.events().publish((symbol_short!("deposit"), pasabuy_id, buyer.clone()), amount);

        Ok(())
    }

    /// Organizer marks a buyer's order as delivered for a specific pasabuy.
    /// Does NOT release funds — only the buyer can release by confirming.
    /// Requires the organizer of THIS pasabuy to authorize.
    pub fn mark_delivered(
        env: Env,
        pasabuy_id: u64,
        buyer: Address,
    ) -> Result<(), Error> {
        // Retrieve and verify organizer authorization for this specific pasabuy
        let organizer: Address = env.storage().persistent()
            .get(&DataKey::PasabuyOrganizer(pasabuy_id))
            .ok_or(Error::PasabuyNotFound)?;
        organizer.require_auth();

        // Verify buyer has deposited for this pasabuy
        let status: OrderStatus = env.storage().persistent()
            .get(&DataKey::BuyerStatus(pasabuy_id, buyer.clone()))
            .ok_or(Error::NotDeposited)?;

        // Verify correct status for transition
        if status != OrderStatus::Deposited {
            return Err(Error::InvalidStatus);
        }

        // Update status to Delivered
        env.storage().persistent().set(
            &DataKey::BuyerStatus(pasabuy_id, buyer.clone()),
            &OrderStatus::Delivered,
        );

        // Record when delivery was marked (starts the confirmation window timer)
        env.storage().persistent().set(
            &DataKey::DeliveredAt(pasabuy_id, buyer.clone()),
            &env.ledger().timestamp(),
        );

        // Emit delivery event
        env.events().publish((symbol_short!("deliver"), pasabuy_id, buyer.clone()), ());

        Ok(())
    }

    /// Buyer confirms delivery for a specific pasabuy. Releases escrowed funds
    /// to the organizer of that pasabuy. This is the ONLY way the organizer
    /// receives payment (aside from release_expired).
    /// Requires buyer authorization.
    pub fn confirm_delivery(
        env: Env,
        pasabuy_id: u64,
        buyer: Address,
    ) -> Result<(), Error> {
        // Verify buyer authorization
        buyer.require_auth();

        // Verify buyer's order is in Delivered state for this pasabuy
        let status: OrderStatus = env.storage().persistent()
            .get(&DataKey::BuyerStatus(pasabuy_id, buyer.clone()))
            .ok_or(Error::NotDelivered)?;

        if status != OrderStatus::Delivered {
            return Err(Error::NotDelivered);
        }

        // Retrieve deposit amount, organizer, and token
        let amount: i128 = env.storage().persistent()
            .get(&DataKey::BuyerDeposit(pasabuy_id, buyer.clone()))
            .unwrap();
        let organizer: Address = env.storage().persistent()
            .get(&DataKey::PasabuyOrganizer(pasabuy_id))
            .ok_or(Error::PasabuyNotFound)?;
        let token_address: Address = env.storage().persistent().get(&DataKey::Token).unwrap();

        // Transfer funds from contract to organizer
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &organizer, &amount);

        // Update status to Confirmed
        env.storage().persistent().set(
            &DataKey::BuyerStatus(pasabuy_id, buyer.clone()),
            &OrderStatus::Confirmed,
        );

        // Emit release event
        env.events().publish((symbol_short!("release"), pasabuy_id, buyer.clone()), amount);

        Ok(())
    }

    /// Buyer requests refund after the pasabuy's deadline has passed.
    /// If the organizer disappears or never delivers, the buyer can reclaim
    /// their full deposit once the deadline passes. No one can prevent this.
    /// Only allowed when status is Deposited. Requires buyer authorization.
    pub fn refund(
        env: Env,
        pasabuy_id: u64,
        buyer: Address,
    ) -> Result<(), Error> {
        // Verify buyer authorization
        buyer.require_auth();

        // Check if pasabuy's deadline has passed
        let deadline: u64 = env.storage().persistent()
            .get(&DataKey::PasabuyDeadline(pasabuy_id))
            .ok_or(Error::PasabuyNotFound)?;

        if env.ledger().timestamp() < deadline {
            return Err(Error::NotExpired);
        }

        // Verify buyer's order is in Deposited state (eligible for refund)
        let status: OrderStatus = env.storage().persistent()
            .get(&DataKey::BuyerStatus(pasabuy_id, buyer.clone()))
            .ok_or(Error::NotDeposited)?;

        if status != OrderStatus::Deposited {
            return Err(Error::NotDeposited);
        }

        // Retrieve deposit amount and token
        let amount: i128 = env.storage().persistent()
            .get(&DataKey::BuyerDeposit(pasabuy_id, buyer.clone()))
            .unwrap();
        let token_address: Address = env.storage().persistent().get(&DataKey::Token).unwrap();

        // Transfer funds from contract back to buyer
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &buyer, &amount);

        // Clean up buyer's storage entries for this pasabuy
        env.storage().persistent().remove(&DataKey::BuyerStatus(pasabuy_id, buyer.clone()));
        env.storage().persistent().remove(&DataKey::BuyerDeposit(pasabuy_id, buyer.clone()));

        // Emit refund event
        env.events().publish((symbol_short!("refund"), pasabuy_id, buyer.clone()), amount);

        Ok(())
    }

    /// Organizer auto-releases funds after the confirmation window expires.
    /// After organizer marks delivered and the window expires (e.g., 3 days),
    /// the organizer can call this to release funds without buyer's confirmation.
    /// Prevents dishonest buyers from receiving goods but never confirming.
    /// Requires organizer authorization for this specific pasabuy.
    pub fn release_expired(
        env: Env,
        pasabuy_id: u64,
        buyer: Address,
    ) -> Result<(), Error> {
        // Retrieve and verify organizer authorization for this pasabuy
        let organizer: Address = env.storage().persistent()
            .get(&DataKey::PasabuyOrganizer(pasabuy_id))
            .ok_or(Error::PasabuyNotFound)?;
        organizer.require_auth();

        // Verify buyer's order is in Delivered state
        let status: OrderStatus = env.storage().persistent()
            .get(&DataKey::BuyerStatus(pasabuy_id, buyer.clone()))
            .ok_or(Error::NotDelivered)?;

        if status != OrderStatus::Delivered {
            return Err(Error::NotDelivered);
        }

        // Check that the confirmation window has expired
        let delivered_at: u64 = env.storage().persistent()
            .get(&DataKey::DeliveredAt(pasabuy_id, buyer.clone()))
            .unwrap();
        let confirm_window: u64 = env.storage().persistent()
            .get(&DataKey::PasabuyConfirmWindow(pasabuy_id))
            .unwrap();

        // If buyer still has time to confirm, reject
        if env.ledger().timestamp() < delivered_at + confirm_window {
            return Err(Error::ConfirmWindowOpen);
        }

        // Confirmation window expired — release funds to organizer
        let amount: i128 = env.storage().persistent()
            .get(&DataKey::BuyerDeposit(pasabuy_id, buyer.clone()))
            .unwrap();
        let token_address: Address = env.storage().persistent().get(&DataKey::Token).unwrap();

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &organizer, &amount);

        // Update status to Confirmed (same end state as buyer confirming)
        env.storage().persistent().set(
            &DataKey::BuyerStatus(pasabuy_id, buyer.clone()),
            &OrderStatus::Confirmed,
        );

        // Emit release event
        env.events().publish((symbol_short!("release"), pasabuy_id, buyer.clone()), amount);

        Ok(())
    }
}

#[cfg(test)]
mod test;
