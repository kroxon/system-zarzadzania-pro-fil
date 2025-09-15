import { LoginRequest, LoginResponse, ForgotPasswordRequest, ResetPasswordRequest } from "../../types"
import { RegisterRequest  } from "../../types";

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
        throw new Error("Login failed")
    }    
    
    const result = await response.json();
    
    
    return( result )
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
    if (!res.ok) throw new Error('Failed to register new user');
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
    if (!res.ok) throw new Error('Failed to request password reset');
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
    if (!res.ok) throw new Error('Failed to reset password');
}



export { loginUser, registerUser };