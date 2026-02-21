import { useEffect, useState } from "react";
import type { ToastMessage } from "../types";
import "./Toast.css";

interface ToastProps {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLeaving(true);
            setTimeout(() => onDismiss(toast.id), 300); // Wait for exit animation
        }, 4000); // 4 seconds before auto-dismiss

        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    return (
        <div className={`toast toast-${toast.type} ${isLeaving ? "toast-exit" : "toast-enter"}`}>
            <div className="toast-icon">
                {toast.type === "success" && "✓"}
                {toast.type === "error" && "✕"}
                {toast.type === "info" && "ℹ"}
            </div>
            <div className="toast-content">
                <span className="toast-title">{toast.title}</span>
                <span className="toast-message">{toast.message}</span>
            </div>
            <button className="toast-close" onClick={() => {
                setIsLeaving(true);
                setTimeout(() => onDismiss(toast.id), 300);
            }}>
                ✕
            </button>
        </div>
    );
}

interface ToastContainerProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
}
