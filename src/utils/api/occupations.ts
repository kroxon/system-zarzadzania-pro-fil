import { Occupation, CreateOccupation, UpdateOccupation } from "../../types";


const API_URL = import.meta.env.VITE_API_URL;

// GET /api/occupations
const getAllOccupations = async (): Promise<Occupation[]> => {
    const res = await fetch(`${API_URL}/api/occupations`, {
        headers: {
            'API-KEY': import.meta.env.API_KEY
        }
    });
    if (!res.ok) throw new Error('Failed to fetch occupations');
    return res.json();
}

// POST /api/occupations

const addNewOccupation = async (token : string, data: CreateOccupation): Promise<Occupation>=> {
    const res = await fetch(`${API_URL}/api/occupations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    if(!res.ok)
    {
        throw new Error("Failed to add new occupation")
    }
    return await res.json();
}

// GET /api/ocupations/{id}

const getOccupation = async (token : string, id: number): Promise<Occupation>=> {
    const res = await fetch(`${API_URL}/api/occupations/${id}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    if(!res.ok)
    {
        throw new Error("Failed to fetch occupation")
    }
    return await res.json();
}

// DELETE /api/occupations/{id}

const deleteOccupation = async (token : string, id: number): Promise<Occupation>=> {
    const res = await fetch(`${API_URL}/api/occupations/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    if(!res.ok)
    {
        throw new Error("Failed to delete occupation")
    }
    return await res.json();
}

// PUT /api/occupations/{id}
const updateOccupation = async (token: string, id: number, data: UpdateOccupation): Promise<void> => {
    const res = await fetch(`${API_URL}/api/occupations/${id}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        throw new Error('Failed to update occupation');
    }
};

export { getAllOccupations, addNewOccupation, getOccupation, deleteOccupation, updateOccupation };