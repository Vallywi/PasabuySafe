import { Contract, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { Server, Api, assembleTransaction } from '@stellar/stellar-sdk/rpc';
import { CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE } from '../utils/constants';

/**
 * Soroban RPC server instance for submitting and simulating transactions.
 */
export const server = new Server(RPC_URL);

/**
 * PasabuySafe contract instance for building invocation operations.
 */
export const contract = new Contract(CONTRACT_ID);

/**
 * Build, simulate, sign (via Freighter), and submit a contract invocation.
 * This is the main helper for all contract interactions.
 */
export async function invokeContract(
  method: string,
  args: xdr.ScVal[],
  publicKey: string
): Promise<Api.GetTransactionResponse> {
  // Load the account sequence number
  const account = await server.getAccount(publicKey);

  // Build the transaction
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Simulate to get the prepared transaction
  const simulated = await server.simulateTransaction(tx);

  if (Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  const prepared = assembleTransaction(tx, simulated).build();

  // Sign with Freighter
  const freighterApi = await import('@stellar/freighter-api');
  const signResult = await freighterApi.signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (signResult.error) {
    throw new Error(`Signing failed: ${signResult.error}`);
  }

  // Submit the signed transaction
  const signedTx = TransactionBuilder.fromXDR(
    signResult.signedTxXdr,
    NETWORK_PASSPHRASE
  );
  const sendResult = await server.sendTransaction(signedTx);

  if (sendResult.status === 'ERROR') {
    throw new Error(`Transaction submission failed`);
  }

  // Poll for result
  let status = await server.getTransaction(sendResult.hash);
  while (status.status === Api.GetTransactionStatus.NOT_FOUND) {
    await new Promise((r) => setTimeout(r, 1500));
    status = await server.getTransaction(sendResult.hash);
  }

  if (status.status === Api.GetTransactionStatus.FAILED) {
    throw new Error('Transaction failed on-chain');
  }

  return status;
}
