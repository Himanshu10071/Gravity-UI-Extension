const TOGGLE_MESSAGE = { type: "PAGE_DROPPER_TOGGLE" };
const LOG_PREFIX = "[Page Dropper]";
const DEBUG = true;

function log(...args) {
	if (DEBUG) {
		console.log(LOG_PREFIX, ...args);
	}
}

function warn(...args) {
	if (DEBUG) {
		console.warn(LOG_PREFIX, ...args);
	}
}

function logCommands() {
	chrome.commands.getAll((commands) => {
		const summary = commands.map((command) => ({
			name: command.name,
			shortcut: command.shortcut || "(unassigned)"
		}));
		log("Registered commands", summary);
	});
}

function injectFiles(tabId) {
	log("Injecting content.css", { tabId });
	chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] }, () => {
		if (chrome.runtime.lastError) {
			warn("Insert CSS failed", chrome.runtime.lastError.message);
			return;
		}

		log("Injecting matter.min.js + content.js", { tabId });
		chrome.scripting.executeScript(
			{ target: { tabId }, files: ["matter.min.js", "content.js"] },
			() => {
				if (chrome.runtime.lastError) {
					warn("Script injection failed", chrome.runtime.lastError.message);
					return;
				}

				log("Scripts injected, sending toggle message", { tabId });
				chrome.tabs.sendMessage(tabId, TOGGLE_MESSAGE, () => {
					if (chrome.runtime.lastError) {
						warn("Toggle message failed", chrome.runtime.lastError.message);
					} else {
						log("Toggle message delivered", { tabId });
					}
				});
			}
		);
	});
}

function toggleOnTab(tabId) {
	log("Sending toggle message", { tabId });
	chrome.tabs.sendMessage(tabId, TOGGLE_MESSAGE, () => {
		if (chrome.runtime.lastError) {
			warn("Toggle failed, injecting files", chrome.runtime.lastError.message);
			injectFiles(tabId);
		} else {
			log("Toggle handled by content script", { tabId });
		}
	});
}

function toggleActiveTab() {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		const tabId = tabs[0]?.id;
		if (!tabId) {
			warn("No active tab found");
			return;
		}

		log("Active tab resolved", { tabId });
		toggleOnTab(tabId);
	});
}

chrome.commands.onCommand.addListener((command) => {
	log("Command received", command);
	if (command === "toggle-page-dropper") {
		toggleActiveTab();
	}
});

log("Background script loaded");
logCommands();

chrome.runtime.onInstalled.addListener((details) => {
	log("Extension installed or updated", details.reason);
	logCommands();
});

chrome.runtime.onStartup.addListener(() => {
	log("Browser startup detected");
	logCommands();
});
