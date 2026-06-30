// PasabuySafe contract and network configuration
// Using v2 contract with confirm_window support
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID!;
export const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;
export const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL!;
export const STELLAR_EXPERT_URL = process.env.NEXT_PUBLIC_STELLAR_EXPERT_URL!;
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

// Native XLM Stellar Asset Contract (testnet)
export const XLM_TOKEN_ADDRESS = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// Confirmation window default: 3 days in seconds
export const DEFAULT_CONFIRM_WINDOW = 259_200;
