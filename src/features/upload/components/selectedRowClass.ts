// Shared option/radio row style used by both `UploadConfirmScreen`'s OCR
// suggestion radios and `MachinePicker`'s brand/template option rows. Both
// surfaces are part of the same confirm-screen visual rhythm, so the
// selected/unselected affordance must stay byte-identical between them.
// Defined once here instead of duplicated as `radioRowClass` and `optionClass`
// in each component file (the duplication was flagged by FF cohesion review).
export function selectedRowClass(isSelected: boolean): string {
  return [
    'flex-row items-center gap-3 rounded-xl border p-4',
    isSelected ? 'border-accent bg-accent/10' : 'border-border bg-bg-muted',
  ].join(' ');
}
