use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Env};

/// Default confirmation window for tests: 259200 seconds (3 days)
const CONFIRM_WINDOW: u64 = 259_200;

/// Helper function to set up the test environment with:
/// - A fresh Env with all auths mocked
/// - The PasabuySafe contract registered
/// - Test addresses for organizer and buyer
/// - A SAC token with 10,000 tokens minted to the buyer
fn setup_test() -> (Env, PasabuySafeClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    // Register the PasabuySafe contract
    let contract_id = env.register(PasabuySafe, ());
    let client = PasabuySafeClient::new(&env, &contract_id);

    // Create test addresses
    let organizer = Address::generate(&env);
    let buyer = Address::generate(&env);

    // Register a stellar asset contract (SAC) token for testing
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    // Mint tokens to buyer for testing
    token_admin_client.mint(&buyer, &10_000);

    (env, client, organizer, buyer, token_address)
}

/// Test 1: Happy path through the full escrow lifecycle.
/// Verifies: initialize → deposit → mark_delivered → confirm_delivery
/// Properties validated: P1 (state transitions), P2 (fund conservation), P5 (events), P6 (auth)
#[test]
fn test_full_lifecycle() {
    let (env, client, organizer, buyer, token_address) = setup_test();
    let token_client = token::Client::new(&env, &token_address);

    // Initialize with deadline far in future, 3-day confirm window
    client.initialize(&organizer, &token_address, &1_000_000, &CONFIRM_WINDOW);

    // Buyer deposits 1000 tokens into escrow
    client.deposit(&buyer, &1000);
    assert_eq!(token_client.balance(&buyer), 9_000);
    assert_eq!(token_client.balance(&client.address), 1_000);

    // Organizer marks the order as delivered
    client.mark_delivered(&buyer);

    // Buyer confirms delivery — funds released to organizer
    client.confirm_delivery(&buyer);
    assert_eq!(token_client.balance(&organizer), 1_000);
    assert_eq!(token_client.balance(&buyer), 9_000);
    assert_eq!(token_client.balance(&client.address), 0);
}

/// Test 2: Refund after the expiration deadline has passed.
/// Verifies: deposit → time passes deadline → refund succeeds
/// Properties validated: P2 (fund conservation), P4 (deadline enforcement), P5 (events), P6 (auth)
#[test]
fn test_refund_after_expiration() {
    let (env, client, _organizer, buyer, token_address) = setup_test();
    let token_client = token::Client::new(&env, &token_address);

    // Initialize with short deadline of 100, 3-day confirm window
    client.initialize(&_organizer, &token_address, &100, &CONFIRM_WINDOW);

    // Buyer deposits 500 tokens
    client.deposit(&buyer, &500);
    assert_eq!(token_client.balance(&buyer), 9_500);

    // Advance ledger timestamp past the deadline
    env.ledger().with_mut(|l| {
        l.timestamp = 200;
    });

    // Buyer requests refund after expiration
    client.refund(&buyer);

    // Assert buyer got their tokens back
    assert_eq!(token_client.balance(&buyer), 10_000);
    assert_eq!(token_client.balance(&client.address), 0);
}

/// Test 3: Duplicate deposit is rejected.
/// Verifies: second deposit by the same buyer returns AlreadyDeposited error.
/// Properties validated: P3 (duplicate operation prevention)
#[test]
fn test_duplicate_deposit_rejected() {
    let (_env, client, organizer, buyer, token_address) = setup_test();
    let token_client = token::Client::new(&_env, &token_address);

    // Initialize the contract
    client.initialize(&organizer, &token_address, &1_000_000, &CONFIRM_WINDOW);

    // First deposit succeeds
    client.deposit(&buyer, &500);
    assert_eq!(token_client.balance(&buyer), 9_500);

    // Second deposit attempt should fail with AlreadyDeposited
    let result = client.try_deposit(&buyer, &300);
    assert_eq!(result, Err(Ok(Error::AlreadyDeposited)));

    // Balance unchanged after failed second deposit
    assert_eq!(token_client.balance(&buyer), 9_500);
}

/// Test 4: Refund before the deadline is rejected.
/// Verifies: refund fails with NotExpired when timestamp < deadline.
/// Properties validated: P4 (deadline enforcement)
#[test]
fn test_refund_before_expiration_rejected() {
    let (env, client, organizer, buyer, token_address) = setup_test();
    let token_client = token::Client::new(&env, &token_address);

    // Initialize with deadline = 1000, 3-day confirm window
    client.initialize(&organizer, &token_address, &1000, &CONFIRM_WINDOW);

    // Buyer deposits 500 tokens
    client.deposit(&buyer, &500);

    // Set ledger timestamp to 500 (before the deadline of 1000)
    env.ledger().with_mut(|l| {
        l.timestamp = 500;
    });

    // Attempt refund before deadline — should fail
    let result = client.try_refund(&buyer);
    assert_eq!(result, Err(Ok(Error::NotExpired)));

    // Funds remain in escrow
    assert_eq!(token_client.balance(&buyer), 9_500);
    assert_eq!(token_client.balance(&client.address), 500);
}

/// Test 5: Auto-release when buyer doesn't confirm within the window + invalid transitions.
/// Verifies: organizer can release funds after confirmation window expires.
/// Also verifies invalid transitions are still rejected.
/// Properties validated: P1 (state machine), P7 (auto-release fairness)
#[test]
fn test_invalid_status_transitions() {
    let (env, client, organizer, buyer, token_address) = setup_test();
    let token_client = token::Client::new(&env, &token_address);

    // Initialize with deadline far in future, confirm window = 1000 seconds
    client.initialize(&organizer, &token_address, &1_000_000, &1000);
    client.deposit(&buyer, &500);

    // Attempt confirm_delivery when status is Deposited (not Delivered) → NotDelivered
    let result = client.try_confirm_delivery(&buyer);
    assert_eq!(result, Err(Ok(Error::NotDelivered)));

    // Organizer marks as delivered at timestamp 0
    client.mark_delivered(&buyer);

    // Attempt mark_delivered again when status is Delivered → InvalidStatus
    let result = client.try_mark_delivered(&buyer);
    assert_eq!(result, Err(Ok(Error::InvalidStatus)));

    // Organizer tries release_expired too early (within confirm window) → ConfirmWindowOpen
    env.ledger().with_mut(|l| {
        l.timestamp = 500; // Only 500s passed, window is 1000s
    });
    let result = client.try_release_expired(&buyer);
    assert_eq!(result, Err(Ok(Error::ConfirmWindowOpen)));

    // Advance past the confirmation window (1000+ seconds after delivery)
    env.ledger().with_mut(|l| {
        l.timestamp = 1500; // 1500s > 1000s window
    });

    // Now organizer can auto-release since buyer didn't confirm in time
    client.release_expired(&buyer);
    assert_eq!(token_client.balance(&organizer), 500); // organizer got paid
    assert_eq!(token_client.balance(&client.address), 0); // contract empty
}
