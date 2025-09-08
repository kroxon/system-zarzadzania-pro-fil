import { LoginRequest, LoginResponse } from "../types"


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

export { loginUser };
