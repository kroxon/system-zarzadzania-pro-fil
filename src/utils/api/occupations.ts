import { Occupation } from "../../types";


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

export default getAllOccupations;