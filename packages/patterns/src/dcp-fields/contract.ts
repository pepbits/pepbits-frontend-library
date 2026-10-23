// Shared wire contract also used by the lower-layer HTTP adapters.
export {
  DCP_RUNTIME_TYPES,
  type DcpRuntimeType,
  type DcpValue,
  type DcpRow,
  type DcpRuntimeField,
  type DcpRuntimeView,
  type DcpLoaded,
  type DcpSaved,
  type DcpSave,
  isDcpRevision,
  isDcpNumber,
  isDcpValues,
  isDcpRuntimeView,
  isDcpLoaded,
  isDcpSaved,
  dcpWritablePatch
} from '@pepbits/data/dcp-runtime';
