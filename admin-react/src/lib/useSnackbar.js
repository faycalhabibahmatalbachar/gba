/**
 * Shim notistack → react-hot-toast
 * Remplace useSnackbar() sans modifier tous les fichiers existants.
 */
import toast from 'react-hot-toast';

export function useSnackbar() {
  const enqueueSnackbar = (message, options = {}) => {
    const variant = options.variant || 'default';
    if (variant === 'success') return toast.success(message);
    if (variant === 'error') return toast.error(message);
    if (variant === 'warning') return toast(message, { icon: '⚠️' });
    return toast(message);
  };

  return { enqueueSnackbar };
}
