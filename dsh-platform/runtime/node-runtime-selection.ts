export type NodeRuntimeTarget = "android-arm64" | "openharmony-arm64";

export interface NodeRuntimeArtifact {
  target: NodeRuntimeTarget;
  nodeVersion: string;
  architecture: "arm64";
  path: string;
  linked: boolean;
}

export function selectNodeRuntime(
  artifacts: NodeRuntimeArtifact[],
  target: NodeRuntimeTarget,
): NodeRuntimeArtifact {
  const artifact = artifacts.find((item) => item.target === target && item.architecture === "arm64");
  if (!artifact) throw new Error("No arm64 Node Runtime for target: " + target);
  if (!artifact.linked) throw new Error("Node Runtime is not linked for target: " + target);
  return artifact;
}
