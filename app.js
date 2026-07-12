const backdropInput = document.querySelector("#backdropInput");
const bannerInput = document.querySelector("#bannerInput");
const backdropDropzone = document.querySelector('label[for="backdropInput"]');
const bannerDropzone = document.querySelector('label[for="bannerInput"]');
const backdropName = document.querySelector("#backdropName");
const bannerName = document.querySelector("#bannerName");
const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");
const downloadButton = document.querySelector("#download");
const resetButton = document.querySelector("#reset");
const canvasSize = document.querySelector("#canvasSize");
const previewFrame = document.querySelector(".preview-frame");
const cropStage = document.querySelector("#cropStage");
const cropHandles = document.querySelectorAll("[data-crop-handle]");

const controls = {
	fadeStart: document.querySelector("#fadeStart"),
	fadeStrength: document.querySelector("#fadeStrength"),
	cropTop: document.querySelector("#cropTop"),
	cropBottom: document.querySelector("#cropBottom"),
	bannerWidth: document.querySelector("#bannerWidth"),
	bannerY: document.querySelector("#bannerY"),
};

const outputs = {
	fadeStart: document.querySelector("#fadeStartValue"),
	fadeStrength: document.querySelector("#fadeStrengthValue"),
	cropTop: document.querySelector("#cropTopValue"),
	cropBottom: document.querySelector("#cropBottomValue"),
	bannerWidth: document.querySelector("#bannerWidthValue"),
	bannerY: document.querySelector("#bannerYValue"),
};

const defaultValues = {
	fadeStart: 25,
	fadeStrength: 80,
	cropTop: 200,
	cropBottom: 0,
	bannerWidth: 70,
	bannerY: 73,
};

const state = {
	backdrop: null,
	banner: null,
};

function loadImage(file) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		const url = URL.createObjectURL(file);

		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error(`Could not load ${file.name}`));
		};
		image.src = url;
	});
}

async function handleUpload(event, key, label) {
	const file = event.target.files?.[0];
	await setImage(file, key, label);
}

async function setImage(file, key, label) {
	if (!file) return;
	if (!file.type.startsWith("image/")) {
		label.textContent = "Drop an image file";
		return;
	}

	try {
		state[key] = await loadImage(file);
		label.textContent = file.name;
		if (key === "backdrop") {
			controls.cropTop.value = defaultValues.cropTop;
			controls.cropBottom.value = defaultValues.cropBottom;
		}
		syncCropLimits();
		render();
	} catch (error) {
		label.textContent = error.message;
	}
}

function updateOutputs() {
	for (const [key, input] of Object.entries(controls)) {
		const suffix = key === "cropTop" || key === "cropBottom" ? "px" : "%";
		outputs[key].textContent = `${input.value}${suffix}`;
	}

	for (const handle of cropHandles) {
		const key = handle.dataset.cropHandle === "top" ? "cropTop" : "cropBottom";
		handle.setAttribute("aria-valuenow", controls[key].value);
		handle.setAttribute("aria-valuemax", controls[key].max);
	}
}

function getCrop() {
	const imageHeight = state.backdrop?.naturalHeight ?? 0;
	const top = Math.min(
		Number(controls.cropTop.value),
		Math.max(0, imageHeight - 1),
	);
	const bottom = Math.min(
		Number(controls.cropBottom.value),
		Math.max(0, imageHeight - top - 1),
	);

	return {
		top,
		bottom,
		height: Math.max(1, imageHeight - top - bottom),
	};
}

function syncCropLimits(changedKey) {
	if (!state.backdrop) return;

	const imageHeight = state.backdrop.naturalHeight;
	let top = Number(controls.cropTop.value);
	let bottom = Number(controls.cropBottom.value);

	if (top + bottom >= imageHeight) {
		if (changedKey === "cropTop") {
			bottom = Math.max(0, imageHeight - top - 1);
		} else {
			top = Math.max(0, imageHeight - bottom - 1);
		}
	}

	controls.cropTop.max = Math.max(0, imageHeight - bottom - 1);
	controls.cropBottom.max = Math.max(0, imageHeight - top - 1);
	controls.cropTop.value = Math.min(top, Number(controls.cropTop.max));
	controls.cropBottom.value = Math.min(bottom, Number(controls.cropBottom.max));
}

function drawBackdrop(image, width, height) {
	const { top } = getCrop();
	const sourceY = top;
	ctx.drawImage(image, 0, sourceY, width, height, 0, 0, width, height);
}

function drawFade(width, height) {
	const fadeStart = Number(controls.fadeStart.value) / 100;
	const fadeStrength = Number(controls.fadeStrength.value) / 100;
	const midPoint = Math.max(0.05, 0.92 - fadeStrength * 0.82);
	const midOpacity = Math.max(0.04, 1 - fadeStrength * 0.96);
	const gradient = ctx.createLinearGradient(0, height * fadeStart, 0, height);
	gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
	gradient.addColorStop(midPoint, `rgba(0, 0, 0, ${midOpacity})`);
	gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
	ctx.globalCompositeOperation = "destination-in";
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);
	ctx.globalCompositeOperation = "source-over";
}

function drawBanner(width, height) {
	if (!state.banner) return;

	const maxWidth = width * (Number(controls.bannerWidth.value) / 100);
	const scale = maxWidth / state.banner.naturalWidth;
	const drawWidth = state.banner.naturalWidth * scale;
	const drawHeight = state.banner.naturalHeight * scale;
	const x = (width - drawWidth) / 2;
	const centerY = height * (Number(controls.bannerY.value) / 100);
	const y = centerY - drawHeight / 2;

	ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
	ctx.shadowBlur = Math.max(12, width * 0.018);
	ctx.shadowOffsetY = Math.max(5, height * 0.012);
	ctx.drawImage(state.banner, x, y, drawWidth, drawHeight);
	ctx.shadowColor = "transparent";
	ctx.shadowBlur = 0;
	ctx.shadowOffsetY = 0;
}

function render() {
	updateOutputs();

	if (!state.backdrop) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		downloadButton.disabled = true;
		previewFrame.classList.remove("has-output");
		canvasSize.textContent = "No backdrop loaded";
		cropStage.style.removeProperty("--stage-aspect");
		cropStage.style.removeProperty("--crop-top");
		cropStage.style.removeProperty("--crop-bottom");
		return;
	}

	syncCropLimits();
	updateOutputs();
	const crop = getCrop();

	canvas.width = state.backdrop.naturalWidth;
	canvas.height = crop.height;
	canvasSize.textContent = `${canvas.width} x ${canvas.height} export from ${state.backdrop.naturalWidth} x ${state.backdrop.naturalHeight}`;
	cropStage.style.setProperty(
		"--stage-aspect",
		`${state.backdrop.naturalWidth} / ${state.backdrop.naturalHeight}`,
	);
	cropStage.style.setProperty(
		"--crop-top",
		`${(crop.top / state.backdrop.naturalHeight) * 100}%`,
	);
	cropStage.style.setProperty(
		"--crop-bottom",
		`${(crop.bottom / state.backdrop.naturalHeight) * 100}%`,
	);

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	drawBackdrop(state.backdrop, canvas.width, canvas.height);
	drawFade(canvas.width, canvas.height);
	drawBanner(canvas.width, canvas.height);

	downloadButton.disabled = !state.banner;
	previewFrame.classList.add("has-output");
}

function resetControls() {
	for (const [key, value] of Object.entries(defaultValues)) {
		controls[key].value = value;
	}
	syncCropLimits();
	render();
}

function resetControl(key) {
	controls[key].value = defaultValues[key];
	syncCropLimits(key);
	render();
}

function cropPixelsFromPointer(event, edge) {
	const rect = cropStage.getBoundingClientRect();
	const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
	const ratio = y / rect.height;
	const imageHeight = state.backdrop.naturalHeight;

	if (edge === "top") return Math.round(ratio * imageHeight);
	return Math.round((1 - ratio) * imageHeight);
}

function bindCropHandle(handle) {
	const edge = handle.dataset.cropHandle;
	const key = edge === "top" ? "cropTop" : "cropBottom";

	handle.addEventListener("pointerdown", (event) => {
		if (!state.backdrop) return;

		event.preventDefault();
		handle.setPointerCapture(event.pointerId);
		handle.classList.add("is-dragging");
	});

	handle.addEventListener("pointermove", (event) => {
		if (!state.backdrop || !handle.hasPointerCapture(event.pointerId)) return;

		controls[key].value = cropPixelsFromPointer(event, edge);
		syncCropLimits(key);
		render();
	});

	for (const eventName of ["pointerup", "pointercancel"]) {
		handle.addEventListener(eventName, (event) => {
			if (handle.hasPointerCapture(event.pointerId)) {
				handle.releasePointerCapture(event.pointerId);
			}
			handle.classList.remove("is-dragging");
		});
	}
}

function download() {
	if (!state.backdrop || !state.banner) return;

	const link = document.createElement("a");
	link.download = "banner-composite.png";
	link.href = canvas.toDataURL("image/png");
	link.click();
}

function bindDropzone(dropzone, key, label) {
	if (!dropzone) return;

	for (const eventName of ["dragenter", "dragover"]) {
		dropzone.addEventListener(eventName, (event) => {
			event.preventDefault();
			event.stopPropagation();
			event.dataTransfer.dropEffect = "copy";
			dropzone.classList.add("is-dragging");
		});
	}

	for (const eventName of ["dragleave", "drop"]) {
		dropzone.addEventListener(eventName, (event) => {
			event.preventDefault();
			event.stopPropagation();
			dropzone.classList.remove("is-dragging");
		});
	}

	dropzone.addEventListener("drop", async (event) => {
		event.preventDefault();
		await setImage(event.dataTransfer?.files?.[0], key, label);
	});
}

for (const eventName of ["dragover", "drop"]) {
	document.addEventListener(eventName, (event) => {
		event.preventDefault();
	});
}

backdropInput.addEventListener("change", (event) =>
	handleUpload(event, "backdrop", backdropName),
);
bannerInput.addEventListener("change", (event) =>
	handleUpload(event, "banner", bannerName),
);
bindDropzone(backdropDropzone, "backdrop", backdropName);
bindDropzone(bannerDropzone, "banner", bannerName);
downloadButton.addEventListener("click", download);
resetButton.addEventListener("click", resetControls);

for (const input of Object.values(controls)) {
	input.addEventListener("input", () => {
		syncCropLimits(input.id);
		render();
	});
}

for (const button of document.querySelectorAll("[data-reset-control]")) {
	button.addEventListener("click", () =>
		resetControl(button.dataset.resetControl),
	);
}

for (const handle of cropHandles) {
	bindCropHandle(handle);
}

render();
