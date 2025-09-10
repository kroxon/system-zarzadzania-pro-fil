import { LoginRequest, LoginResponse } from "../../types"
import { RegisterRequest  } from "../../types";

const API_URL = import.meta.env.VITE_API_URL;

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

export { loginUser, registerUser };