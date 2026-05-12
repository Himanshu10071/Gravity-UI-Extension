const TOGGLE_MESSAGE = { type: "PAGE_DROPPER_TOGGLE" };
function injectFiles(tabId) {
	chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] }, () => {
		if (chrome.runtime.lastError) {
			return;
		}

		chrome.scripting.executeScript(
			{ target: { tabId }, files: ["matter.min.js", "content.js"] },
			() => {
				if (chrome.runtime.lastError) {
					return;
				}

				chrome.tabs.sendMessage(tabId, TOGGLE_MESSAGE, () => {
					return;
				});
			}
		);
	});
}

function toggleOnTab(tabId) {
	chrome.tabs.sendMessage(tabId, TOGGLE_MESSAGE, () => {
		if (chrome.runtime.lastError) {
			injectFiles(tabId);
		}
	});
}

function toggleActiveTab() {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		const tabId = tabs[0]?.id;
		if (!tabId) {
			return;
		}

		toggleOnTab(tabId);
	});
}

chrome.commands.onCommand.addListener((command) => {
	if (command === "toggle-page-dropper") {
		toggleActiveTab();
	}
});
