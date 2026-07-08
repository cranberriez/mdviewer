export function enableEditorCheckboxes(element: HTMLElement) {
	element.querySelectorAll<HTMLInputElement>("input[type='checkbox']").forEach((checkbox) => {
		checkbox.checked = checkbox.hasAttribute('checked');
		checkbox.defaultChecked = checkbox.checked;
		checkbox.contentEditable = 'false';
		checkbox.disabled = false;
	});
}
