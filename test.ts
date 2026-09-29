/**
 * Smoke test: fake ExtensionAPI, no network. `bun test.ts`.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const { default: activate } = await import("./index.ts");

interface Handlers {
	settled?: () => void;
	command?: { handler: (args: string, ctx: unknown) => Promise<void> };
}

interface Fake {
	pi: ExtensionAPI;
	handlers: Handlers;
	sent: { content: string; options?: unknown }[];
	notifications: string[];
	idle: boolean;
}

function fakePi(): Fake {
	const handlers: Handlers = {};
	const fake: Fake = {
		handlers,
		sent: [],
		notifications: [],
		idle: true,
		pi: {
			on: (event: string, handler: never) => {
				if (event === "agent_settled") handlers.settled = handler as never;
				return () => {};
			},
			sendUserMessage: async (content: unknown, options?: unknown) => {
				fake.sent.push({
					content: Array.isArray(content)
						? (content as { text: string }[]).map((b) => b.text).join("")
						: String(content),
					options,
				});
			},
			registerCommand: (_name: string, cmd: never) => {
				handlers.command = cmd as never;
			},
		} as unknown as ExtensionAPI,
	};
	return fake;
}

function cmdCtx(fake: Fake) {
	return { ui: { notify: (t: string) => fake.notifications.push(t) }, isIdle: () => fake.idle };
}

let failures = 0;
function assert(cond: boolean, label: string) {
	console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
	if (!cond) failures++;
}

async function run() {
	{
		const fake = fakePi();
		await activate(fake.pi);

		// no run yet → refuse politely
		await fake.handlers.command!.handler("", cmdCtx(fake));
		assert(fake.sent.length === 0, "no message sent before any run");
		assert(fake.notifications.some((n) => n.includes("nothing to continue")), "pre-run refusal notifies");

		// a run settles → /continue sends the resume instruction
		fake.handlers.settled!();
		await fake.handlers.command!.handler("", cmdCtx(fake));
		assert(fake.sent.length === 1, "sends one message");
		assert(fake.sent[0].content.includes("Resume your previous task"), "resume instruction content");
		assert(fake.sent[0].options === undefined, "idle path sends without queue options");
		assert(fake.notifications.some((n) => n.includes("resuming")), "resume notifies");

		// args pass through as extra instruction
		await fake.handlers.command!.handler("run the tests first", cmdCtx(fake));
		assert(fake.sent[1].content.includes("Extra instruction: run the tests first"), "args appended");

		// second settle increments the counter
		fake.handlers.settled!();
		await fake.handlers.command!.handler("", cmdCtx(fake));
		assert(fake.notifications.some((n) => n.includes("run #3")), "run counter increments");

		// busy agent → queued as follow-up
		fake.idle = false;
		await fake.handlers.command!.handler("", cmdCtx(fake));
		assert(fake.sent[3].options && (fake.sent[3].options as { deliverAs?: string }).deliverAs === "followUp", "busy path queues as follow-up");
		assert(fake.notifications.some((n) => n.includes("follow-up")), "busy path notifies");
	}

	console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURE(S)`);
	process.exit(failures === 0 ? 0 : 1);
}

await run();
