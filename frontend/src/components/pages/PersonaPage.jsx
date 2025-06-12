import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

const PersonaPage = () => {
  const [personas, setPersonas] = useState([]);

  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'personas'));
        const personaList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPersonas(personaList);
      } catch (error) {
        console.error('Error fetching personas:', error);
      }
    };

    fetchPersonas();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Persona Configuration</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personas.map(persona => (
          <div key={persona.id} className="p-4 border rounded shadow">
            <h2 className="text-xl font-semibold">{persona.name}</h2>
            <p className="text-gray-600">{persona.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonaPage;
