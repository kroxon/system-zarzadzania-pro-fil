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
// Returns void (204) or occupation payload depending on backend; we normalize to void.
// On error throws enriched Error with status & backend message.
const deleteOccupation = async (token : string, id: number): Promise<void>=> {
    const res = await fetch(`${API_URL}/api/occupations/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        let backendMsg: string | undefined;
        try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await res.json().catch(() => undefined);
                backendMsg = (data?.message || data?.error || (typeof data === 'string' ? data : undefined));
            } else {
                const text = await res.text();
                backendMsg = text || undefined;
            }
        } catch { /* ignore parsing errors */ }
        const err = new Error(backendMsg ? `DELETE ${res.status}: ${backendMsg}` : `Failed to delete occupation (status ${res.status})`);
        // @ts-ignore
        err.status = res.status;
        throw err;
    }
    // Some APIs return JSON, some 204 no-content; we safely ignore body.
    return;
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