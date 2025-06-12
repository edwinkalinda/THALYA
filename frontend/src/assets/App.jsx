import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// --- Icon Components ---
const Bot = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>);
const ChevronRight = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>);
const BookUser = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><circle cx="12" cy="10" r="2"/><path d="M12 12v3a2 2 0 0 0 4 0"/></svg>);
const BarChart3 = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>);
const Settings = (props) => ( <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l-.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1-1-1.73l-.43-.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0 2l.15.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>);

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAOZUUEKbf1OdfmJenKG2LWENrOciLrfyo",
  authDomain: "thalya-project.firebaseapp.com",
  projectId: "thalya-project",
  storageBucket: "thalya-project.appspot.com",
  messagingSenderId: "773730474701",
  appId: "1:773730474701:web:a8ba1920ba81b0a367e784"
};

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-900/20 border border-red-700 rounded-lg">
          <h2 className="text-xl font-bold text-red-400">Something went wrong</h2>
          <p className="text-gray-300 mt-2">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Main App Component ---
export default function App() {
  const [db, setDb] = useState(null);
  const [page, setPage] = useState('persona');
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);
  
  const businessId = "restaurant_123";

  useEffect(() => {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "VOTRE_CLE_API_FIREBASE") {
      try {
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        setDb(firestore);
      } catch (error) { console.error("Erreur d'initialisation de Firebase :", error); }
    }
    setFirebaseInitialized(true);
  }, []);
  
  const NavItem = ({ icon, label, pageName }) => (
    <button onClick={() => setPage(pageName)} className={`flex items-center w-full px-4 py-3 text-left text-lg rounded-lg transition-colors ${page === pageName ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
        {icon}<span className="ml-4">{label}</span><ChevronRight className="ml-auto h-5 w-5" />
    </button>
  );

  const renderPage = () => {
    if (!db) return <div className="text-center p-10 text-gray-400">Initialisation de la connexion...</div>;
    switch (page) {
      case 'persona': return <PersonaPage db={db} businessId={businessId} />;
      case 'knowledge': return <KnowledgePage db={db} businessId={businessId} />;
      case 'analytics': return <AnalyticsPage db={db} businessId={businessId} />;
      case 'setup': return <SetupPage />;
      default: return <PersonaPage db={db} businessId={businessId} />;
    }
  };

  if (firebaseInitialized && !db) {
    return (
        <div className="flex h-screen w-full bg-gray-900 text-white items-center justify-center p-8">
            <div className="text-center bg-red-900/50 border border-red-700 p-10 rounded-lg max-w-2xl">
                <h1 className="text-3xl font-bold text-red-300 mb-4">Configuration Requise</h1>
                <p className="text-lg text-gray-200">Il semble y avoir un problème avec la configuration de Firebase. Veuillez vérifier les clés dans `src/App.jsx`.</p>
            </div>
        </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-full bg-gray-900 text-gray-200 font-sans">
        <aside className="w-80 flex-shrink-0 bg-gray-800 p-6 flex flex-col border-r border-gray-700">
          <div className="flex items-center mb-12"><div className="p-3 bg-blue-600 rounded-full"><Bot className="h-8 w-8 text-white"/></div><h1 className="text-2xl font-bold ml-4">Thalya</h1></div>
          <nav className="flex flex-col space-y-3">
            <NavItem icon={<Bot className="h-6 w-6"/>} label="Persona de l'IA" pageName="persona" />
            <NavItem icon={<BookUser className="h-6 w-6"/>} label="Base de Connaissances" pageName="knowledge" />
            <NavItem icon={<BarChart3 className="h-6 w-6"/>} label="Analyses d'Appels" pageName="analytics" />
            <NavItem icon={<Settings className="h-6 w-6"/>} label="Configuration" pageName="setup" />
          </nav>
          <div className="mt-auto text-sm text-gray-500"><p>&copy; 2025 Thalya AI</p></div>
        </aside>
        <main className="flex-1 overflow-y-auto bg-gray-900 p-12">{renderPage()}</main>
      </div>
    </ErrorBoundary>
  );
}

const PageHeader = ({ title, description }) => (<div className="mb-10"><h2 className="text-4xl font-bold text-white mb-2">{title}</h2><p className="text-lg text-gray-400">{description}</p></div>);
const SaveButton = ({ onSave, isSaving }) => ( <button onClick={onSave} disabled={isSaving} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">{isSaving ? 'Sauvegarde...' : 'Sauvegarder les changements'}</button>);
const TextAreaField = ({ label, id, value, onChange, placeholder, rows = 4 }) => (<div><label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">{label}</label><textarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"/></div>);
const ErrorDisplay = ({ message }) => message ? <p className="text-red-400 bg-red-900/30 p-3 rounded-lg mb-4">{message}</p> : null;

function PersonaPage({ db, businessId }) {
    const [persona, setPersona] = useState({ personality: '', objective: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const loadData = useCallback(async () => {
        if (!db) return;
        try { const docSnap = await getDoc(doc(db, "businesses", businessId)); if (docSnap.exists() && docSnap.data().persona) setPersona(docSnap.data().persona); } catch (err) { setError("Impossible de charger les données."); }
    }, [db, businessId]);
    useEffect(() => { loadData(); }, [loadData]);
    
    const handleSave = async () => {
        if(!db) return; setIsSaving(true); setError('');
        try { await setDoc(doc(db, "businesses", businessId), { persona }, { merge: true }); } catch (err) { setError("Impossible de sauvegarder les données."); } finally { setIsSaving(false); }
    };

    return (<div><PageHeader title="Persona de l'IA" description="Définissez comment Thalya pense et se comporte." /><ErrorDisplay message={error} /><div className="space-y-8 max-w-3xl"><TextAreaField label="Personnalité & Ton" id="personality" value={persona.personality} onChange={(e) => setPersona({...persona, personality: e.target.value})} placeholder="Ex: 'Amicale, professionnelle et légèrement formelle.'" rows={3} /><TextAreaField label="Objectif Principal" id="objective" value={persona.objective} onChange={(e) => setPersona({...persona, objective: e.target.value})} placeholder="Ex: 'Réserver efficacement et répondre aux questions de base.'" rows={5} /><SaveButton onSave={handleSave} isSaving={isSaving} /></div></div>);
}

function KnowledgePage({ db, businessId }) {
    const [conversation, setConversation] = useState([{ role: 'model', parts: [{ text: "Bonjour ! Je suis là pour construire la base de connaissances de votre IA. Pour commencer, quel est le nom de votre entreprise et quel est son secteur d'activité ?" }] }]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [knowledge, setKnowledge] = useState({ full_details: '' });

    const loadKnowledge = useCallback(async () => {
      if (!db) return;
      const docRef = doc(db, "businesses", businessId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().knowledge) {
        setKnowledge(docSnap.data().knowledge);
      }
    }, [db, businessId]);
    useEffect(() => { loadKnowledge(); }, [loadKnowledge]);

    const handleSendMessage = async () => {
        if (!userInput.trim() || isLoading) return;
        const newHistory = [...conversation, { role: 'user', parts: [{ text: userInput }] }];
        setConversation(newHistory);
        setUserInput(''); setIsLoading(true);
        try {
            const response = await fetch('http://localhost:5000/api/onboarding-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: newHistory }) });
            if (!response.ok) throw new Error("Erreur réseau");
            const data = await response.json();
            setConversation([...newHistory, { role: 'model', parts: [{ text: data.reply }] }]);
        } catch (error) {
            setConversation([...newHistory, { role: 'model', parts: [{ text: "Désolé, j'ai rencontré une erreur. Veuillez réessayer." }] }]);
        } finally { setIsLoading(false); }
    };
    
    const handleSaveKnowledge = async () => {
        if (!db) return;
        setIsLoading(true);
        try { await setDoc(doc(db, "businesses", businessId), { knowledge }, { merge: true }); } catch(e) { console.error(e); } finally { setIsLoading(false); }
    }

    return (<div><PageHeader title="Base de Connaissances" description="Discutez avec notre IA pour construire la base de connaissances de Thalya." /><div className="flex gap-8"><div className="w-2/3"><div className="bg-gray-800 rounded-lg h-[60vh] flex flex-col"><div className="flex-1 p-6 space-y-4 overflow-y-auto">{conversation.map((msg, index) => (<div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><p className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>{msg.parts[0].text}</p></div>))
            }{isLoading && <div className="flex justify-start"><p className="max-w-md p-3 rounded-lg bg-gray-700">...</p></div>}</div><div className="p-4 border-t border-gray-700 flex gap-4"><input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Écrivez votre réponse ici..." className="w-full bg-gray-700 border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500" /><button onClick={handleSendMessage} disabled={isLoading} className="px-6 py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-50">Envoyer</button></div></div></div><div className="w-1/3"><div className="bg-gray-800 rounded-lg p-6"><h3 className="text-xl font-bold mb-4">Connaissances Extraites</h3><p className="text-sm text-gray-400 mb-4">Pendant la discussion, vous pouvez éditer le résumé final ici avant de sauvegarder.</p><TextAreaField label="Résumé des Connaissances" id="knowledgeSummary" value={knowledge.full_details} onChange={(e) => setKnowledge({...knowledge, full_details: e.target.value})} placeholder="Ex: Nous sommes un cabinet dentaire nommé 'Sourires Radieux'. Ouvert du Lun-Ven 9h-17h. Nous proposons détartrages, blanchiments..." rows={12} /><div className="mt-4"><SaveButton onSave={handleSaveKnowledge} isSaving={isLoading}/></div></div></div></div></div>);
}

function AnalyticsPage({ db, businessId }) {
    const [logs] = useState([ { id: 1, timestamp: '10/06/2025 15:30', summary: "Réservation pour Marc L. (2 pers.)", status: 'Succès' }, { id: 2, timestamp: '10/06/2025 14:15', summary: "Question sur les options sans gluten", status: 'N/A' }, { id: 3, timestamp: '10/06/2025 11:45', summary: "Réservation pour Jeanne D. (4 pers.)", status: 'Succès' }, { id: 4, timestamp: '09/06/2025 18:05', summary: "Tentative de réservation échouée", status: 'Échec' }, ]);
    return (<div><PageHeader title="Analyses d'Appels" description="Examinez les appels récents gérés par Thalya." /><div className="bg-gray-800 rounded-lg overflow-hidden"><table className="w-full text-left"><thead className="bg-gray-700/50"><tr><th className="p-4 font-semibold">Horodatage</th><th className="p-4 font-semibold">Résumé de l'Appel</th><th className="p-4 font-semibold text-center">Statut d'Automatisation</th></tr></thead><tbody>{logs.map(log => (<tr key={log.id} className="border-b border-gray-700 last:border-b-0"><td className="p-4 text-gray-400">{log.timestamp}</td><td className="p-4">{log.summary}</td><td className="p-4 text-center"><span className={`px-3 py-1 text-xs font-semibold rounded-full ${log.status === 'Succès' ? 'bg-green-500/20 text-green-300' : log.status === 'Échec' ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-300'}`}>{log.status}</span></td></tr>))}</tbody></table></div></div>);
}

function SetupPage() {
    return (<div><PageHeader title="Configuration & Intégration" description="Connectez Thalya à votre ligne téléphonique et vos outils d'automatisation." /><div className="max-w-4xl text-gray-400 space-y-8">
      <div><h3 className="text-2xl font-semibold text-white mb-3">Étape 1 : Configurer Twilio</h3><p>Achetez un numéro de téléphone sur la console Twilio. Dans sa configuration vocale, réglez "A CALL COMES IN" sur un Webhook pointant vers votre serveur backend.</p></div>
      <div><h3 className="text-2xl font-semibold text-white mb-3">Étape 2 : Connecter Zapier</h3><p>Créez un "Zap" dans Zapier avec un déclencheur "Webhook". Copiez l'URL unique fournie et collez-la dans votre fichier `.env` en tant que `ZAPIER_WEBHOOK_URL`.</p></div>
    </div></div>);
}
