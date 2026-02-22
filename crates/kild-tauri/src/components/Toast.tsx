import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ToastMessage } from "../types";
import "./Toast.css";

interface ToastProps {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, 4000); // 4 seconds before auto-dismiss
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className={`toast toast-${toast.type}`}
        >
            <div className="toast-icon">
                {toast.type === "success" && "✓"}
                {toast.type === "error" && "✕"}
                {toast.type === "info" && "ℹ"}
            </div>
            <div className="toast-content">
                <span className="toast-title">{toast.title}</span>
                <span className="toast-message">{toast.message}</span>
            </div>
            <button className="toast-close" onClick={() => onDismiss(toast.id)}>
                ✕
            </button>
        </motion.div>
    );
}

interface ToastContainerProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    return (
        <div className="toast-container">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
                ))}
            </AnimatePresence>
        </div>
    );
}
