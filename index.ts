/**
 * continue — one command, one job: pick the task back up.
 *
 * The agent's transcript already holds everything it needs: what it did, what
 * it learned, what is still open. So "continue" needs none of that repeated —
 * it needs one nudge that says "keep going from where you stopped". That is
 * the whole extension.
 *
 * `/continue` sends a user message ("always triggers a turn" per the pi API)
 * telling the agent to resume its previous task without redoing finished
 * work. Anything typed after the command is passed through as an extra
 * instruction, so `/continue run the tests first` still reads naturally.
 *
 * Two small courtesies:
 *   - `/continue` before any run in this session says so instead of sending
 *     the agent into a void.
 *   - `/continue` while the agent is still streaming queues as a follow-up
 *     rather than steering mid-thought, and says it did.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const RESUME_INSTRUCTION =
	"[pi-continue] Resume your previous task from exactly where you left off. " +
	"Do not redo completed work or re-explain the task; pick up the next pending " +
	"step and carry it to completion.";

export default async function (pi: ExtensionAPI) {
	let runsSeen = 0;

	pi.on("agent_settled", () => {
		runsSeen++;
	});

	pi.registerCommand("continue", {
		description: "Continue the previous task where it left off. Extra text is passed along as an instruction",
		handler: async (args, ctx) => {
			const cmdCtx = ctx as {
				ui?: { notify?: (text: string, level?: string) => void };
				isIdle?: () => boolean;
			};
			const notify = (text: string) => {
				try {
					cmdCtx.ui?.notify?.(text, "info");
				} catch {
					console.log(`[pi-continue] ${text}`);
				}
			};

			if (runsSeen === 0) {
				notify("pi-continue: nothing to continue yet — no agent run in this session");
				return;
			}

			const extra = args.trim();
			const content = extra ? `${RESUME_INSTRUCTION}\nExtra instruction: ${extra}` : RESUME_INSTRUCTION;
			const idle = cmdCtx.isIdle?.() ?? true;
			if (idle) {
				await pi.sendUserMessage(content);
				notify(`pi-continue: resuming (run #${runsSeen + 1})`);
			} else {
				await pi.sendUserMessage(content, { deliverAs: "followUp" });
				notify("pi-continue: agent still running — queued as follow-up");
			}
		},
	});
}
