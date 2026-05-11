(() => {
	const existing = window.__PAGE_DROPPER__;
	if (existing && typeof existing.toggle === "function") {
		existing.toggle();
		return;
	}

	const api = {};
	const MESSAGE_TYPE = "PAGE_DROPPER_TOGGLE";
	const DATA_ATTR = "data-page-dropper";
	const OVERLAY_ID = "page-dropper-outline";
	const DROP_LAYER_ID = "page-dropper-layer";
	const HOVER_CLASS = "pd-hovered";
	const PLACEHOLDER_CLASS = "pd-placeholder";
	const TOAST_CLASS = "pd-toast";
	const LOG_PREFIX = "[Page Dropper]";
	const DEBUG = true;

	const state = {
		enabled: false,
		engine: null,
		runner: null,
		bounds: [],
		overlay: null,
		dropLayer: null,
		hovered: null,
		items: new Map(),
		resizeHandler: null,
		toast: null,
		toastTimeout: null,
		syncHandle: null,
		syncRunning: false
	};

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

	function describeElement(element) {
		if (!element) {
			return "(none)";
		}

		const tag = element.tagName ? element.tagName.toLowerCase() : "unknown";
		const id = element.id ? `#${element.id}` : "";
		const classes = element.classList
			? Array.from(element.classList)
					.slice(0, 2)
					.map((name) => `.${name}`)
					.join("")
			: "";
		return `${tag}${id}${classes}`;
	}

	log("Content script loaded", window.location.href);

	function isDroppable(element) {
		if (!element || !(element instanceof Element)) {
			return false;
		}

		if (element === document.body || element === document.documentElement) {
			return false;
		}

		if (element.hasAttribute(DATA_ATTR) || element.closest(`[${DATA_ATTR}]`)) {
			return false;
		}

		return true;
	}

	function ensureOverlay() {
		if (state.overlay) {
			return;
		}

		const overlay = document.createElement("div");
		overlay.id = OVERLAY_ID;
		overlay.setAttribute(DATA_ATTR, "overlay");
		overlay.style.display = "none";
		document.documentElement.appendChild(overlay);
		state.overlay = overlay;
		log("Overlay created");
	}

	function ensureDropLayer() {
		if (state.dropLayer) {
			return;
		}

		const layer = document.createElement("div");
		layer.id = DROP_LAYER_ID;
		layer.setAttribute(DATA_ATTR, "layer");
		document.documentElement.appendChild(layer);
		state.dropLayer = layer;
		log("Drop layer created");
	}

	function updateOverlay(target) {
		if (!state.overlay || !target) {
			clearOverlay();
			return;
		}

		const rect = target.getBoundingClientRect();
		if (rect.width < 4 || rect.height < 4) {
			clearOverlay();
			return;
		}

		state.overlay.style.display = "block";
		state.overlay.style.opacity = "1";
		state.overlay.style.width = `${rect.width}px`;
		state.overlay.style.height = `${rect.height}px`;
		state.overlay.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
	}

	function clearOverlay() {
		if (state.overlay) {
			state.overlay.style.display = "none";
		}
		if (state.hovered) {
			state.hovered.classList.remove(HOVER_CLASS);
		}
		state.hovered = null;
	}

	function startSyncLoop() {
		if (state.syncRunning) {
			return;
		}

		state.syncRunning = true;
		const loop = () => {
			syncBodies();
			if (state.syncRunning) {
				state.syncHandle = requestAnimationFrame(loop);
			}
		};
		state.syncHandle = requestAnimationFrame(loop);
	}

	function setHoverTarget(target) {
		if (state.hovered && state.hovered !== target) {
			state.hovered.classList.remove(HOVER_CLASS);
		}

		state.hovered = target;
		if (target) {
			target.classList.add(HOVER_CLASS);
		}
	}

	function showToast(message, tone) {
		if (state.toast) {
			state.toast.remove();
			state.toast = null;
		}

		const toast = document.createElement("div");
		toast.className = TOAST_CLASS;
		toast.setAttribute(DATA_ATTR, "toast");
		if (tone) {
			toast.dataset.tone = tone;
		}
		toast.textContent = message;
		document.documentElement.appendChild(toast);
		state.toast = toast;

		requestAnimationFrame(() => {
			if (state.toast === toast) {
				toast.classList.add("pd-toast--show");
			}
		});

		if (state.toastTimeout) {
			clearTimeout(state.toastTimeout);
		}

		state.toastTimeout = setTimeout(() => {
			toast.classList.remove("pd-toast--show");
			setTimeout(() => {
				if (toast.parentNode) {
					toast.remove();
				}
				if (state.toast === toast) {
					state.toast = null;
				}
			}, 250);
		}, 1600);
	}

	function getDocumentSize() {
		const root = document.documentElement;
		const body = document.body;
		const width = Math.max(
			root.scrollWidth,
			root.offsetWidth,
			root.clientWidth,
			body ? body.scrollWidth : 0,
			body ? body.offsetWidth : 0,
			body ? body.clientWidth : 0,
			window.innerWidth
		);
		const height = Math.max(
			root.scrollHeight,
			root.offsetHeight,
			root.clientHeight,
			body ? body.scrollHeight : 0,
			body ? body.offsetHeight : 0,
			body ? body.clientHeight : 0,
			window.innerHeight
		);

		return { width, height };
	}

	function rebuildBounds() {
		if (!state.engine) {
			return;
		}

		const { Bodies, Composite } = Matter;
		const { width: docWidth, height: docHeight } = getDocumentSize();
		const width = Math.max(docWidth, window.innerWidth);
		const height = Math.max(docHeight, window.innerHeight);
		const floorThickness = 80;
		const wallThickness = 80;
		const wallHeight = height * 2;

		if (state.bounds.length) {
			state.bounds.forEach((body) => Composite.remove(state.engine.world, body));
		}

		const floor = Bodies.rectangle(
			width / 2,
			height + floorThickness / 2,
			width,
			floorThickness,
			{ isStatic: true, label: "pd-floor" }
		);
		const leftWall = Bodies.rectangle(
			-wallThickness / 2,
			height / 2,
			wallThickness,
			wallHeight,
			{ isStatic: true, label: "pd-left-wall" }
		);
		const rightWall = Bodies.rectangle(
			width + wallThickness / 2,
			height / 2,
			wallThickness,
			wallHeight,
			{ isStatic: true, label: "pd-right-wall" }
		);

		state.bounds = [floor, leftWall, rightWall];
		Composite.add(state.engine.world, state.bounds);
		log("Bounds rebuilt", { width, height, docWidth, docHeight });
	}

	function ensurePhysics() {
		if (state.engine) {
			return;
		}

		if (typeof Matter === "undefined") {
			warn("Matter.js not available");
			return;
		}

		const { Engine, Runner } = Matter;
		const engine = Engine.create();
		engine.gravity.y = 1;

		state.engine = engine;
		state.runner = Runner.create();
		log("Physics engine created");

		rebuildBounds();
		Runner.run(state.runner, engine);
		log("Physics runner started");
		startSyncLoop();

		if (!state.resizeHandler) {
			state.resizeHandler = () => rebuildBounds();
			window.addEventListener("resize", state.resizeHandler);
			log("Resize handler attached");
		}
	}

	function syncBodies() {
		if (!state.items.size) {
			return;
		}

		const scrollX = window.scrollX || window.pageXOffset;
		const scrollY = window.scrollY || window.pageYOffset;

		for (const [body, item] of state.items.entries()) {
			const x = body.position.x - item.width / 2 - scrollX;
			const y = body.position.y - item.height / 2 - scrollY;
			const offsetX = x - item.originLeft;
			const offsetY = y - item.originTop;
			item.element.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${body.angle}rad)`;
		}
	}

	function dropElement(target) {
		ensurePhysics();
		if (!state.engine) {
			return;
		}

		const rect = target.getBoundingClientRect();
		const computed = getComputedStyle(target);
		const scrollX = window.scrollX || window.pageXOffset;
		const scrollY = window.scrollY || window.pageYOffset;
		const pageLeft = rect.left + scrollX;
		const pageTop = rect.top + scrollY;
		if (rect.width < 2 || rect.height < 2) {
			log("Drop skipped (too small)", describeElement(target));
			return;
		}

		log("Dropping element", describeElement(target), {
			width: rect.width,
			height: rect.height
		});

		target.classList.remove(HOVER_CLASS);

		const clone = target.cloneNode(true);
		clone.removeAttribute("id");
		clone.setAttribute(DATA_ATTR, "dropped");
		clone.classList.add("pd-dropped");
		clone.style.width = `${rect.width}px`;
		clone.style.height = `${rect.height}px`;
		clone.style.margin = "0";
		clone.style.left = `${rect.left}px`;
		clone.style.top = `${rect.top}px`;
		clone.style.transform = "translate(0px, 0px)";
		clone.style.display = computed.display === "inline" ? "inline-block" : computed.display;
		clone.style.boxSizing = "border-box";

		const placeholder = document.createElement("div");
		placeholder.className = PLACEHOLDER_CLASS;
		placeholder.setAttribute(DATA_ATTR, "placeholder");
		placeholder.style.width = `${rect.width}px`;
		placeholder.style.height = `${rect.height}px`;
		placeholder.style.marginTop = computed.marginTop;
		placeholder.style.marginRight = computed.marginRight;
		placeholder.style.marginBottom = computed.marginBottom;
		placeholder.style.marginLeft = computed.marginLeft;
		placeholder.style.display =
			computed.display === "inline" || computed.display === "contents" ? "inline-block" : computed.display;
		placeholder.style.boxSizing = "border-box";
		placeholder.style.padding = "0";
		placeholder.style.border = "0";
		placeholder.style.background = "transparent";
		placeholder.style.visibility = "hidden";
		placeholder.style.pointerEvents = "none";
		placeholder.style.verticalAlign = computed.verticalAlign;
		placeholder.style.cssFloat = computed.cssFloat;
		placeholder.style.flex = computed.flex;
		placeholder.style.alignSelf = computed.alignSelf;

		target.replaceWith(placeholder);

		ensureDropLayer();
		state.dropLayer.appendChild(clone);
		log("Clone appended and original removed");
		rebuildBounds();

		const { Bodies, Composite } = Matter;
		const body = Bodies.rectangle(
			pageLeft + rect.width / 2,
			pageTop + rect.height / 2,
			rect.width,
			rect.height,
			{
				restitution: 0.2,
				friction: 0.8,
				frictionAir: 0.02,
				density: 0.002
			}
		);

		state.items.set(body, {
			element: clone,
			width: rect.width,
			height: rect.height,
			originLeft: rect.left,
			originTop: rect.top
		});
		Composite.add(state.engine.world, body);
		log("Physics body added", { items: state.items.size });
	}

	function handleMove(event) {
		if (!state.enabled) {
			return;
		}

		const target = document.elementFromPoint(event.clientX, event.clientY);
		if (!isDroppable(target)) {
			if (state.hovered) {
				log("Hover cleared", describeElement(state.hovered));
			}
			clearOverlay();
			return;
		}

		if (target !== state.hovered) {
			log("Hover target", describeElement(target));
		}
		setHoverTarget(target);
		updateOverlay(target);
	}

	function handleClick(event) {
		if (!state.enabled || event.button !== 0) {
			return;
		}

		const target = document.elementFromPoint(event.clientX, event.clientY);
		if (!isDroppable(target)) {
			log("Click ignored (not droppable)");
			return;
		}

		setHoverTarget(target);
		log("Click drop", describeElement(target));

		event.preventDefault();
		event.stopImmediatePropagation();
		dropElement(target);
		clearOverlay();
	}

	function enable() {
		if (state.enabled) {
			return;
		}

		state.enabled = true;
		ensureOverlay();
		ensurePhysics();
		document.addEventListener("mousemove", handleMove, true);
		document.addEventListener("click", handleClick, true);
		log("Extension enabled");
		showToast("Extension Enabled", "on");
	}

	function disable() {
		if (!state.enabled) {
			return;
		}

		state.enabled = false;
		clearOverlay();
		document.removeEventListener("mousemove", handleMove, true);
		document.removeEventListener("click", handleClick, true);
		log("Extension disabled");
		showToast("Extension Disabled", "off");
	}

	function toggle() {
		log("Toggle requested", { enabled: state.enabled });
		if (state.enabled) {
			disable();
		} else {
			enable();
		}
	}

	api.toggle = toggle;
	api.enable = enable;
	api.disable = disable;
	window.__PAGE_DROPPER__ = api;

	chrome.runtime.onMessage.addListener((message) => {
		if (message && message.type === MESSAGE_TYPE) {
			log("Toggle message received");
			toggle();
		}
	});
})();
