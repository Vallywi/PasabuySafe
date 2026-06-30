use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Env};

/// Default confirmation window for tests: 259200 seconds (3 days)
const CONFIRM_WINDOW: u64 = 259_200;

/// Helper function to set up the test environment with:
/// - A fresh Env with all auths mocked
/// - The PasabuySafe contract registered
/// - Test addresses for admin, organizer, and buyer
/// - A SAC token with 10,000 tokens minted to the buyer
/// - Contract initialized with admin and token
/// - A pasabuy created by the organizer
fn setup_test() -> (Env, PasabuySafeClient<'static>, Address, Address, Address, u64) {
    let env = Env::default();
    env.mock_all_auths();

    // Register the PasabuySafe contract
    let contract_id = env.register(PasabuySafe, ());
    let client = PasabuySafeClient::new(&env, &contract_id);

    // Create test addresses
    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let buyer = Address::generate(&env);

    // Register a stellar asset contract (SAC) token for testing
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    // Mint tokens to buyer for testing
    token_admin_client.mint(&buyer, &10_000);

    // Initialize the platform
    client.initialize(&admin, &token_address);

    // Create a pasabuy with deadline far in future & 3-day confirm window
    let pasabuy_id = client.create_pasabuy(&organizer, &1_000_000, &CONFIRM_WINDOW);

    (env, client, organizer, buyer, token_address, pasabuy_id)
}

/// Test 1: Happy path through the full escrow lifecycle.
/// Verifies: initialize → create_pasabuy → deposit → mark_delivered → confirm_delivery
#[test]
fn test_full_lifecycle() {
    let (env, client, organizer, buyer, token_address, pasabuy_id) = setup_test();
    let token_client = token::Client::new(&env, &token_address);

    // Buyer deposits 1000 tokens into escrow for this pasabuy
    client.deposit(&pasabuy_id, &buyer, &1000);
    assert_eq!(token_client.balance(&buyer), 9_000);
    assert_eq!(token_client.balance(&client.address), 1_000);

    // Organizer marks the order as delivered
    client.mark_delivered(&pasabuy_id, &buyer);

    // Buyer confirms delivery — funds released to organizer
    client.confirm_delivery(&pasabuy_id, &buyer);
    assert_eq!(token_client.balance(&organizer), 1_000);
    assert_eq!(token_client.balance(&buyer), 9_000);
    assert_eq!(token_client.balance(&client.address), 0);
}

/// Test 2: Refund after the expiration deadline has passed.
/// Verifies: deposit → time passes deadline → refund succeeds
#[test]
fn test_refund_after_expiration() {
    let (env, client, _organizer, buyer, token_address, _) = setup_test();
    let token_client = token::Client::new(&env, &token_address);

    // Create a pasabuy with a short deadline of 100
    let pasabuy_id = client.create_pasabuy(&_organizer, &100, &CONFIRM_WINDOW);

    // Buyer deposits 500 tokens
    client.deposit(&pasabuy_id, &buyer, &500);
    assert_eq!(token_client.balance(&buyer), 9_500);

    // Advance ledger timestamp past the deadline
    env.ledger().with_mut(|l| {
        l.timestamp = 200;
    });

    // Buyer requests refund after expiration
    client.refund(&pasabuy_id, &buyer);

    // Assert buyer got their tokens back
    assert_eq!(token_client.balance(&buyer), 10_000);
    assert_eq!(token_client.balance(&client.address), 0);
}

/// Test 3: Duplicate deposit is rejected.
/// Verifies: second deposit by the same buyer returns AlreadyDeposited error.
#[test]
fn test_duplicate_deposit_rejected() {
    let (_env, client, _organizer, buyer, token_address, pasabuy_id) = setup_test();
    let token_client = token::Client::new(&_env, &token_address);

    // First deposit succeeds
    client.deposit(&pasabuy_id, &buyer, &500);
    assert_eq!(token_client.balance(&buyer), 9_500);

    // Second deposit attempt should fail with AlreadyDeposited
    let result = client.try_deposit(&pasabuy_id, &buyer, &300);
    assert_eq!(result, Err(Ok(Error::AlreadyDeposited)));

    // Balance unchanged after failed second deposit
    assert_eq!(token_client.balance(&buyer), 9_500);
}

/// Test 4: Refund before the deadline is rejected.
/// Verifies: refund fails with NotExpired when timestamp < deadline.
#[test]
fn test_refund_before_expiration_rejected() {
    let (env, client, organizer, buyer, token_address, _) = setup_test();
    let token_client = token::Client::new(&env, &token_address);

    // Create a pasabuy with deadline = 1000
    let pasabuy_id = client.create_pasabuy(&organizer, &1000, &CONFIRM_WINDOW);

    // Buyer deposits 500 tokens
    client.deposit(&pasabuy_id, &buyer, &500);

    // Set ledger timestamp to 500 (before the deadline of 1000)
    env.ledger().with_mut(|l| {
        l.timestamp = 500;
    });

    // Attempt refund before deadline — should fail
    let result = client.try_refund(&pasabuy_id, &buyer);
    assert_eq!(result, Err(Ok(Error::NotExpired)));

    // Funds remain in escrow
    assert_eq!(token_client.balance(&buyer), 9_500);
    assert_eq!(token_client.balance(&client.address), 500);
}

/// Test 5: Auto-release when buyer doesn't confirm within the window + invalid transitions.
/// Verifies: organizer can release funds after confirmation window expires.
#[test]
fn test_invalid_status_transitions() {
    let (env, client, organizer, buyer, token_address, _) = setup_test();
    let token_client = token::Client::new(&env, &token_address);

    // Create a pasabuy with confirm window = 1000 seconds
    let pasabuy_id = client.create_pasabuy(&organizer, &1_000_000, &1000);

    client.deposit(&pasabuy_id, &buyer, &500);

    // Attempt confirm_delivery when status is Deposited (not Delivered) → NotDelivered
    let result = client.try_confirm_delivery(&pasabuy_id, &buyer);
    assert_eq!(result, Err(Ok(Error::NotDelivered)));

    // Organizer marks as delivered at timestamp 0
    client.mark_delivered(&pasabuy_id, &buyer);

    // Attempt mark_delivered again when status is Delivered → InvalidStatus
    let result = client.try_mark_delivered(&pasabuy_id, &buyer);
    assert_eq!(result, Err(Ok(Error::InvalidStatus)));

    // Organizer tries release_expired too early (within confirm window) → ConfirmWindowOpen
    env.ledger().with_mut(|l| {
        l.timestamp = 500; // Only 500s passed, window is 1000s
    });
    let result = client.try_release_expired(&pasabuy_id, &buyer);
    assert_eq!(result, Err(Ok(Error::ConfirmWindowOpen)));

    // Advance past the confirmation window (1000+ seconds after delivery)
    env.ledger().with_mut(|l| {
        l.timestamp = 1500; // 1500s > 1000s window
    });

    // Now organizer can auto-release since buyer didn't confirm in time
    client.release_expired(&pasabuy_id, &buyer);
    assert_eq!(token_client.balance(&organizer), 500); // organizer got paid
    assert_eq!(token_client.balance(&client.address), 0); // contract empty
}

/// Test 6: Multiple organizers can create independent pasabuys.
/// Verifies: different organizers manage their own pasabuys independently.
#[test]
fn test_multiple_organizers() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PasabuySafe, ());
    let client = PasabuySafeClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let organizer_a = Address::generate(&env);
    let organizer_b = Address::generate(&env);
    let buyer_a = Address::generate(&env);
    let buyer_b = Address::generate(&env);

    // Setup token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
    token_admin_client.mint(&buyer_a, &10_000);
    token_admin_client.mint(&buyer_b, &10_000);

    let token_client = token::Client::new(&env, &token_address);

    // Initialize platform
    client.initialize(&admin, &token_address);

    // Two different organizers create their own pasabuys
    let pasabuy_a = client.create_pasabuy(&organizer_a, &1_000_000, &CONFIRM_WINDOW);
    let pasabuy_b = client.create_pasabuy(&organizer_b, &2_000_000, &CONFIRM_WINDOW);

    assert_eq!(pasabuy_a, 0);
    assert_eq!(pasabuy_b, 1);

    // Buyers deposit into different pasabuys
    client.deposit(&pasabuy_a, &buyer_a, &1000);
    client.deposit(&pasabuy_b, &buyer_b, &2000);

    // Organizer A marks delivery for their pasabuy
    client.mark_delivered(&pasabuy_a, &buyer_a);
    client.confirm_delivery(&pasabuy_a, &buyer_a);

    // Organizer B marks delivery for their pasabuy
    client.mark_delivered(&pasabuy_b, &buyer_b);
    client.confirm_delivery(&pasabuy_b, &buyer_b);

    // Each organizer gets their own buyer's funds
    assert_eq!(token_client.balance(&organizer_a), 1_000);
    assert_eq!(token_client.balance(&organizer_b), 2_000);
    assert_eq!(token_client.balance(&client.address), 0);
}

/// Test 7: PasabuyNotFound error when using invalid pasabuy_id.
#[test]
fn test_pasabuy_not_found() {
    let (_env, client, _organizer, buyer, _token_address, _pasabuy_id) = setup_test();

    // Try to deposit into a non-existent pasabuy
    let result = client.try_deposit(&999, &buyer, &100);
    assert_eq!(result, Err(Ok(Error::PasabuyNotFound)));
}
