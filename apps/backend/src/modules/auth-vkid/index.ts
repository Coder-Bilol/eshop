import { ModuleProvider, Modules } from "@medusajs/framework/utils";

import VkIdAuthService from "./service";

export default ModuleProvider(Modules.AUTH, {
  services: [VkIdAuthService],
});
