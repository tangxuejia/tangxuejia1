#include "dsh_hap_bridge.h"

namespace dsh::hap {

ProcessResult StartEmbeddedNode(const std::vector<std::string>&) {
  // The real implementation is bound to the selected Node Mobile/OpenHarmony
  // runtime package. Fail closed until that binary is linked.
  return {"", false, "Embedded Node runtime is not linked"};
}

bool StopEmbeddedNode(const std::string&) {
  return false;
}

} // namespace dsh::hap
