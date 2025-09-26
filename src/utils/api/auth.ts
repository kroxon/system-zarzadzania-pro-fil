import { LoginRequest, LoginResponse, ForgotPasswordRequest, ResetPasswordRequest } from "../../types"
import { RegisterRequest  } from "../../types";
import { notify, notifyFromResponseError, translateMessage } from "../../components/common/Notification";

const API_URL = import.meta.env.VITE_API_URL;

//login

const loginUser = async (data : LoginRequest): Promise<LoginResponse> => {
    const options = { 
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'API-KEY': import.meta.env.API_KEY
    },
    body: JSON.stringify(data) }

    const response = await fetch(`${API_URL}/api/auth/login`, options)
    if (!response.ok){
        // Let the backend message be the single source of truth (translated)
        await notifyFromResponseError(response, 'error', { single: true, dropGeneric: true });
        throw new Error("Login failed")
    }
    const result = await response.json();
    return result
};




//register

const registerUser = async (data: RegisterRequest): Promise<void> => {
    const res = await fetch(`${API_URL}/api/auth/register`,{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'API-KEY': import.meta.env.API_KEY
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        await notifyFromResponseError(res, 'error', { single: true, dropGeneric: true });
        throw new Error('Failed to register new user');
    }
    // Emit two notifications:
    // 1) short immediate confirmation (as before)
    // 2) longer explanatory notification with extended duration so the user
    //    has time to read the acceptance information before it disappears
    notify.success('Rejestracja zakończona pomyślnie.');
    notify.info('Twoje konto zostało utworzone i oczekuje na akceptację administratora.', { duration: 12000 });
}


// POST /api/auth/forgot-password
export async function forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        await notifyFromResponseError(res, 'error', { single: true, dropGeneric: true });
        throw new Error('Failed to request password reset');
    }
    // Try to show backend success message(s) if present (translated)
    try {
        const data = await res.clone().json();
        // Prefer the first meaningful backend message and translate it.
        let chosen: string | undefined;
        if (data?.message && typeof data.message === 'string') chosen = data.message;
        else if (Array.isArray(data?.messages) && data.messages.length) chosen = data.messages.find((m: any) => typeof m === 'string');
        if (chosen) notify.info(translateMessage(chosen));
        else notify.info('Wysłano e-mail do resetu hasła');
    } catch {
        // no JSON body or no messages - fall back to generic info
        notify.info('Wysłano e-mail do resetu hasła');
    }
}

// POST /api/auth/reset-password
export async function resetPassword(data: ResetPasswordRequest): Promise<void> {
    const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        await notifyFromResponseError(res, 'error', { single: true, dropGeneric: true });
        throw new Error('Failed to reset password');
    }
    try {
        const data = await res.clone().json();
        // Prefer single backend message for success (translated)
        let chosen: string | undefined;
        if (data?.message && typeof data.message === 'string') chosen = data.message;
        else if (Array.isArray(data?.messages) && data.messages.length) chosen = data.messages.find((m: any) => typeof m === 'string');
        if (chosen) notify.success(translateMessage(chosen));
        else notify.success('Hasło zostało zresetowane');
    } catch {
        notify.success('Hasło zostało zresetowane');
    }
}



export { loginUser, registerUser };