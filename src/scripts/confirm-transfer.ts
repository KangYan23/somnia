// backend/api/confirmTransfer.ts
import { sdk } from '../lib/somnia.ts';
import { encodeAbiParameters } from 'viem';
import type { AbiParameter } from 'viem';

export interface ConfirmTransferParams {
  fromPhoneHash: `0x${string}`;
  toPhoneHash: `0x${string}`;
  fromPhone: string;  // Actual phone number
  toPhone: string;    // Actual phone number
  amount: bigint;
  token: string;
  txHash: `0x${string}`;
}

export async function confirmTransfer(params: ConfirmTransferParams) {
  const { fromPhoneHash, toPhoneHash, fromPhone, toPhone, amount, token, txHash } = params;

  // Encode non-indexed fields: fromPhone, toPhone, amount, token, txHash
  const data = encodeAbiParameters(
    [
      { type: 'string' },   // fromPhone
      { type: 'string' },   // toPhone
      { type: 'uint256' },  // amount
      { type: 'string' },   // token
      { type: 'bytes32' }   // txHash
    ] as AbiParameter[],
    [fromPhone, toPhone, amount, token, txHash]
  );

  const tx = await sdk.streams.emitEvents([
    {
      id: 'TransferConfirmed', // event schema ID
      argumentTopics: [
        fromPhoneHash,  // indexed
        toPhoneHash     // indexed
      ],
      data
    }
  ]);

  console.log('TransferConfirmed event emitted:', tx);
  return tx;
}
