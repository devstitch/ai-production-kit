import { generateDraftResponse100 } from "./generate-draft-response/1.0.0.js";
import { PromptRegistry } from "./registry.js";
import { supportTicketTriage100 } from "./support-ticket-triage/1.0.0.js";
import { supportTicketTriage110 } from "./support-ticket-triage/1.1.0.js";
import { supportTicketTriage120 } from "./support-ticket-triage/1.2.0.js";

export const builtinPrompts = new PromptRegistry();

supportTicketTriage100(builtinPrompts);
supportTicketTriage110(builtinPrompts);
supportTicketTriage120(builtinPrompts);
generateDraftResponse100(builtinPrompts);
