#pragma once

#include <string>
#include <vector>

namespace dsh::hap {

struct ProcessResult {
  std::string id;
  bool started;
  std::string error;
};

ProcessResult StartEmbeddedNode(const std::vector<std::string>& argv);
bool StopEmbeddedNode(const std::string& id);

} // namespace dsh::hap
