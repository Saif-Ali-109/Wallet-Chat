import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CHAT_REGISTRY_ADDRESS } from '../lib/ethereum'
import ChatRegistryABI from '../lib/abi/ChatRegistry.json'
import { stringToHex } from 'viem'

export function useChatContract() {
  const { data: hash, error, isPending, writeContract } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    })

  const registerIdentity = async (encryptionKey: string) => {
    return writeContract({
      address: CHAT_REGISTRY_ADDRESS as `0x${string}`,
      abi: ChatRegistryABI.abi,
      functionName: 'registerIdentity',
      args: [stringToHex(encryptionKey)],
    })
  }

  return {
    registerIdentity,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  }
}

export function useEncryptionKey(address: string | undefined) {
  return useReadContract({
    address: CHAT_REGISTRY_ADDRESS as `0x${string}`,
    abi: ChatRegistryABI.abi,
    functionName: 'getEncryptionKey',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    },
  })
}
