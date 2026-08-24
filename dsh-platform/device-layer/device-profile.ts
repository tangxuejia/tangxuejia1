import type { DeviceInfo } from "../dsh-core/contracts";

export type HuaweiFormFactor = "phone" | "tablet" | "foldable" | "desktop";

export interface HuaweiDeviceProfile {
  formFactor: HuaweiFormFactor;
  density: "compact" | "standard" | "large";
  supportsSplitView: boolean;
  supportsKeyboard: boolean;
  supportsLongRunningProcess: boolean;
}

export function getHuaweiDeviceProfile(info: DeviceInfo): HuaweiDeviceProfile {
  const model = info.model.toLowerCase();
  if (model.includes("matebook") || model.includes("desktop")) {
    return { formFactor: "desktop", density: "large", supportsSplitView: true, supportsKeyboard: true, supportsLongRunningProcess: true };
  }
  if (model.includes("pad") || model.includes("tablet")) {
    return { formFactor: "tablet", density: "large", supportsSplitView: true, supportsKeyboard: true, supportsLongRunningProcess: true };
  }
  if (model.includes("fold") || model.includes("pura x")) {
    return { formFactor: "foldable", density: "standard", supportsSplitView: true, supportsKeyboard: false, supportsLongRunningProcess: true };
  }
  return { formFactor: "phone", density: "standard", supportsSplitView: false, supportsKeyboard: false, supportsLongRunningProcess: true };
}
