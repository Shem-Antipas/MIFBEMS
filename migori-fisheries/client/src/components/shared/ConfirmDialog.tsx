interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({ title, message, onConfirm, onCancel }: ConfirmDialogProps) => {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border px-3 py-2 text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
