// Stub for @noble/hashes/_assert to fix @scure/bip32 compatibility
// @scure/bip32@1.7.0 imports 'bytes' which doesn't exist in @noble/hashes@1.8.0
import { abytes } from '@noble/hashes/utils';

// Export 'bytes' as an alias for 'abytes' to satisfy @scure/bip32
export const bytes = abytes;
export { abytes, aexists, anumber, aoutput } from '@noble/hashes/utils';
