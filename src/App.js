import React, { useState, useEffect } from 'react';

// --- Helper Components ---

// Icon component for visual elements
const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d={path} />
    </svg>
);

// Icons for different sections
const DocumentIcon = () => <Icon path="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />;
const CompareIcon = () => <Icon path="M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z" />;
const GenerateIcon = () => <Icon path="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />;
const UploadIcon = () => <Icon path="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" className="w-5 h-5 mr-2" />;
const LoadingIcon = ({ text = '' }) => (
    <div className="flex items-center justify-center">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {text}
    </div>
);

// Modal for displaying messages
const Modal = ({ message, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl p-6 md:p-8 max-w-sm w-full text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Notification</h3>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
                onClick={onClose}
                className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-transform transform hover:scale-105"
            >
                Close
            </button>
        </div>
    </div>
);

// --- File Parsing Logic ---

// Helper to load external scripts
const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.body.appendChild(script);
    });
};

// Function to read and parse different file types
const parseFile = async (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    const fileBuffer = await file.arrayBuffer();

    if (extension === 'txt') {
        return new TextDecoder().decode(fileBuffer);
    }

    if (extension === 'pdf') {
        if (!window.pdfjsLib) {
            throw new Error('PDF library is not loaded.');
        }
        // Use the full HTTPS URL to avoid protocol issues in sandboxed environments
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js`;
        const pdf = await window.pdfjsLib.getDocument({ data: fileBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }
        return text;
    }

    if (extension === 'docx') {
        if (!window.mammoth) {
            throw new Error('DOCX library is not loaded.');
        }
        const result = await window.mammoth.extractRawText({ arrayBuffer: fileBuffer });
        return result.value;
    }

    throw new Error('Unsupported file type. Please upload a .txt, .pdf, or .docx file.');
};


// --- Main Tool Components ---

// Define a character limit for API calls
const API_CHAR_LIMIT = 100000; // Approx. 25,000 words, a safe limit for the API

// 1. Intelligent Clause Extractor
const ClauseExtractor = () => {
    const [contractText, setContractText] = useState('');
    const [fileName, setFileName] = useState('');
    const [extractedClauses, setExtractedClauses] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState(null);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsParsing(true);
        setError(null);
        setFileName(file.name);
        setContractText('');
        setExtractedClauses(null);

        try {
            const text = await parseFile(file);
            setContractText(text);
        } catch (err) {
            setError(err.message);
            setFileName('');
        } finally {
            setIsParsing(false);
            event.target.value = null; // Reset file input
        }
    };

    const callGeminiAPI = async (prompt) => {
        setIsLoading(true);
        setError(null);
        setExtractedClauses(null);
        try {
            // This reads the API key from your .env file in local development
            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = {
                contents: chatHistory,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            clauses: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        clause_type: { type: "STRING" },
                                        summary: { type: "STRING" },
                                        verbatim_text: { type: "STRING" }
                                    },
                                    required: ["clause_type", "summary", "verbatim_text"]
                                }
                            }
                        }
                    }
                }
            };

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API call failed with status: ${response.status}. Body: ${errorBody}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                const parsedJson = JSON.parse(text);
                setExtractedClauses(parsedJson.clauses || []);
            } else {
                console.error("Unexpected API response structure:", result);
                throw new Error("Unexpected API response structure or no content.");
            }
        } catch (err) {
            console.error("Error in Gemini API call:", err);
            setError("Failed to extract clauses. This can happen with very large documents. Please try a smaller file.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleExtract = () => {
        if (!contractText.trim()) {
            setError("Please upload a contract file to analyze.");
            return;
        }

        // Check if the document exceeds the character limit
        if (contractText.length > API_CHAR_LIMIT) {
            setError(`Document is too large (${contractText.length} characters). Please use a file with fewer than ${API_CHAR_LIMIT} characters.`);
            return;
        }

        const prompt = `
            Analyze the following legal contract text. Identify and extract key clauses. For each clause, provide:
            1. The type of clause (e.g., "Limitation of Liability", "Confidentiality", "Term and Termination", "Governing Law", "Indemnification").
            2. A brief, one-sentence summary of the clause's core purpose.
            3. The exact verbatim text of the clause.
            Contract Text:
            ---
            ${contractText}
            ---
        `;
        callGeminiAPI(prompt);
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50 rounded-xl shadow-inner">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 text-center">Intelligent Clause Extractor</h2>

            <div className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg text-center bg-white">
                <label htmlFor="file-upload" className="cursor-pointer text-blue-600 font-semibold hover:text-blue-700">
                    <UploadIcon />
                    <span>Choose a contract file (.txt, .pdf, .docx)</span>
                </label>
                <input id="file-upload" type="file" className="hidden" accept=".txt,.pdf,.docx" onChange={handleFileChange} />
                {isParsing && <p className="mt-4 text-gray-600 font-semibold">Parsing file...</p>}
                {fileName && !isParsing && <p className="mt-4 text-gray-600">Selected: <span className="font-semibold">{fileName}</span></p>}
            </div>

            <div className="text-center mt-6">
                <button
                    onClick={handleExtract}
                    disabled={isLoading || isParsing || !contractText}
                    className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-transform transform hover:scale-105 flex items-center justify-center mx-auto"
                >
                    {isLoading ? <LoadingIcon text="Analyzing..."/> : 'Extract Clauses'}
                </button>
            </div>
            {error && <div className="mt-6 p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg text-center">{error}</div>}
            {extractedClauses && (
                <div className="mt-8">
                    <h3 className="text-xl md:text-2xl font-semibold text-gray-700 mb-4 text-center">Extracted Clauses</h3>
                    {extractedClauses.length > 0 ? (
                        <div className="space-y-4">
                            {extractedClauses.map((clause, index) => (
                                <div key={index} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                                    <h4 className="font-bold text-lg text-blue-700">{clause.clause_type}</h4>
                                    <p className="text-gray-600 mt-2 italic"><strong>Summary:</strong> {clause.summary}</p>
                                    <p className="text-gray-800 mt-4 bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap font-mono text-sm">
                                        {clause.verbatim_text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 mt-6">No specific clauses could be identified. The text might be too short or not a standard contract.</p>
                    )}
                </div>
            )}
        </div>
    );
};

// 2. Contract Version Comparison Tool
const ContractComparer = () => {
    const [text1, setText1] = useState('');
    const [text2, setText2] = useState('');
    const [fileName1, setFileName1] = useState('');
    const [fileName2, setFileName2] = useState('');
    const [isParsing1, setIsParsing1] = useState(false);
    const [isParsing2, setIsParsing2] = useState(false);
    const [comparisonResult, setComparisonResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFileChange = (version) => async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const setIsParsing = version === 'A' ? setIsParsing1 : setIsParsing2;
        const setFileName = version === 'A' ? setFileName1 : setFileName2;
        const setText = version === 'A' ? setText1 : setText2;

        setIsParsing(true);
        setError(null);
        setFileName(file.name);
        setText('');
        setComparisonResult('');

        try {
            const parsedText = await parseFile(file);
            setText(parsedText);
        } catch (err) {
            setError(err.message);
            setFileName('');
        } finally {
            setIsParsing(false);
            event.target.value = null;
        }
    };

    const callGeminiAPI = async (prompt) => {
        setIsLoading(true);
        setError(null);
        setComparisonResult('');
        try {
            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API call failed with status: ${response.status}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                const formattedText = text
                    .replace(/^- (.*)$/gm, '<p class="text-red-600">- $1</p>')
                    .replace(/^\+ (.*)$/gm, '<p class="text-green-600">+ $1</p>')
                    .replace(/^  (.*)$/gm, '<p class="text-gray-500">  $1</p>')
                    .replace(/\n/g, '');
                setComparisonResult(formattedText);
            } else {
                throw new Error("Unexpected API response structure or no content.");
            }
        } catch (err) {
            console.error("Error in Gemini API call:", err);
            setError("Failed to compare versions. This can happen with very large documents. Please try smaller files.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompare = () => {
        if (!text1.trim() || !text2.trim()) {
            setError("Please upload both versions of the contract.");
            return;
        }

        // Check if either document exceeds the character limit
        if (text1.length > API_CHAR_LIMIT || text2.length > API_CHAR_LIMIT) {
            setError(`One or both documents are too large. Please use files with fewer than ${API_CHAR_LIMIT} characters each.`);
            return;
        }

        const prompt = `
            You are a legal contract comparison tool. Compare the two contract versions below (Version A and Version B).
            Identify and list the differences in a "diff" format.
            - Use a minus sign (-) for lines removed from Version A.
            - Use a plus sign (+) for lines added in Version B.
            - Use two spaces for unchanged lines to provide context.
            - Provide a brief summary of the key changes at the very top.
            --- VERSION A ---
            ${text1}
            --- VERSION B ---
            ${text2}
        `;
        callGeminiAPI(prompt);
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50 rounded-xl shadow-inner">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 text-center">Contract Version Comparison</h2>
            <div className="grid md:grid-cols-2 gap-6">
                {/* Version A Upload */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Version A (Original)</h3>
                    <div className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg text-center bg-white">
                        <label htmlFor="file-upload-A" className="cursor-pointer text-blue-600 font-semibold hover:text-blue-700">
                            <UploadIcon />
                            <span>Choose a file (.txt, .pdf, .docx)</span>
                        </label>
                        <input id="file-upload-A" type="file" className="hidden" accept=".txt,.pdf,.docx" onChange={handleFileChange('A')} />
                        {isParsing1 && <p className="mt-4 text-gray-600 font-semibold">Parsing file...</p>}
                        {fileName1 && !isParsing1 && <p className="mt-4 text-gray-600">Selected: <span className="font-semibold">{fileName1}</span></p>}
                    </div>
                </div>
                {/* Version B Upload */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Version B (Revised)</h3>
                    <div className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg text-center bg-white">
                        <label htmlFor="file-upload-B" className="cursor-pointer text-blue-600 font-semibold hover:text-blue-700">
                            <UploadIcon />
                            <span>Choose a file (.txt, .pdf, .docx)</span>
                        </label>
                        <input id="file-upload-B" type="file" className="hidden" accept=".txt,.pdf,.docx" onChange={handleFileChange('B')} />
                        {isParsing2 && <p className="mt-4 text-gray-600 font-semibold">Parsing file...</p>}
                        {fileName2 && !isParsing2 && <p className="mt-4 text-gray-600">Selected: <span className="font-semibold">{fileName2}</span></p>}
                    </div>
                </div>
            </div>
            <div className="text-center mt-6">
                <button
                    onClick={handleCompare}
                    disabled={isLoading || isParsing1 || isParsing2 || !text1 || !text2}
                    className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-transform transform hover:scale-105 flex items-center justify-center mx-auto"
                >
                    {isLoading ? <LoadingIcon text="Comparing..."/> : 'Compare Versions'}
                </button>
            </div>
            {error && <div className="mt-6 p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg text-center">{error}</div>}
            {comparisonResult && (
                <div className="mt-8">
                    <h3 className="text-xl md:text-2xl font-semibold text-gray-700 mb-4 text-center">Comparison Result</h3>
                    <div
                        className="bg-white p-6 rounded-lg shadow-md border border-gray-200 whitespace-pre-wrap font-mono text-sm"
                        dangerouslySetInnerHTML={{ __html: comparisonResult }}
                    />
                </div>
            )}
        </div>
    );
};

// 3. Basic Contract Generation Assistant
const ContractGenerator = () => {
    const [contractType, setContractType] = useState('NDA');
    const [customDetails, setCustomDetails] = useState('');
    const [generatedContract, setGeneratedContract] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [modalMessage, setModalMessage] = useState('');

    const callGeminiAPI = async (prompt) => {
        setIsLoading(true);
        setError(null);
        setGeneratedContract('');
        try {
            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API call failed with status: ${response.status}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                setGeneratedContract(text);
            } else {
                throw new Error("Unexpected API response structure or no content.");
            }
        } catch (err) {
            console.error("Error in Gemini API call:", err);
            setError("Failed to generate the contract. The AI model may be busy. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = () => {
        if (!customDetails.trim()) {
            setError("Please provide some details for the contract.");
            return;
        }
        const prompt = `
            You are a basic contract generation assistant. Generate a simple ${contractType}.
            Incorporate the following details provided by the user.
            The output should be a complete, well-formatted contract draft.
            Use clear placeholders like [Disclosing Party Name], [Receiving Party Name], [Effective Date], etc.
            Add a clear disclaimer at the very bottom stating: "This is an AI-generated draft and not legal advice. Consult with a qualified legal professional before use."
            User-provided details:
            ---
            ${customDetails}
            ---
        `;
        callGeminiAPI(prompt);
    };

    const handleCopyToClipboard = () => {
        if (!generatedContract) return;

        const textarea = document.createElement('textarea');
        textarea.value = generatedContract;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            setModalMessage('Contract copied to clipboard!');
        } catch (err) {
            setModalMessage('Failed to copy text.');
        }
        document.body.removeChild(textarea);
    };

    return (
        <div className="p-4 md:p-8 bg-gray-50 rounded-xl shadow-inner">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 text-center">Contract Generation Assistant</h2>
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <label htmlFor="contractType" className="block text-lg font-semibold text-gray-700 mb-2">Select Contract Type</label>
                    <select
                        id="contractType"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                        value={contractType}
                        onChange={(e) => setContractType(e.target.value)}
                    >
                        <option value="NDA">Non-Disclosure Agreement (NDA)</option>
                        <option value="SOW">Statement of Work (SOW)</option>
                        <option value="MSA">Master Service Agreement (MSA)</option>
                    </select>
                </div>
                <div className="mb-6">
                    <label htmlFor="customDetails" className="block text-lg font-semibold text-gray-700 mb-2">Provide Key Details</label>
                    <textarea
                        id="customDetails"
                        className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                        placeholder="e.g., Parties involved: 'Innovate Corp' and 'Data Solutions LLC'. Purpose: Discussing a potential software development project. Confidential information includes business plans, financial data, and source code."
                        value={customDetails}
                        onChange={(e) => setCustomDetails(e.target.value)}
                    ></textarea>
                </div>
                <div className="text-center">
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-transform transform hover:scale-105 flex items-center justify-center mx-auto"
                    >
                        {isLoading ? <LoadingIcon text="Generating..."/> : 'Generate Contract'}
                    </button>
                </div>
            </div>
            {error && <div className="mt-6 p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg text-center">{error}</div>}
            {generatedContract && (
                <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl md:text-2xl font-semibold text-gray-700">Generated Draft</h3>
                        <button
                            onClick={handleCopyToClipboard}
                            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                        >
                            Copy Text
                        </button>
                    </div>
                    <textarea
                        readOnly
                        className="w-full h-96 p-4 bg-white border border-gray-200 rounded-lg font-mono text-sm"
                        value={generatedContract}
                    />
                </div>
            )}
            {modalMessage && <Modal message={modalMessage} onClose={() => setModalMessage('')} />}
        </div>
    );
};


// --- App Component (Main Layout) ---

export default function App() {
    const [activeTool, setActiveTool] = useState('extractor');
    const [scriptsLoaded, setScriptsLoaded] = useState(false);

    // Load external libraries for file parsing when the app starts
    useEffect(() => {
        Promise.all([
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.min.js'),
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js')
        ]).then(() => {
            setScriptsLoaded(true);
        }).catch(error => {
            console.error(error);
            // Optionally, show an error to the user that file parsing might not work
        });
    }, []);

    const renderTool = () => {
        if (!scriptsLoaded) {
            return <div className="text-center p-10">Loading file parsing libraries...</div>;
        }
        switch (activeTool) {
            case 'extractor':
                return <ClauseExtractor />;
            case 'comparer':
                return <ContractComparer />;
            case 'generator':
                return <ContractGenerator />;
            default:
                return <ClauseExtractor />;
        }
    };

    const NavButton = ({ tool, label, icon }) => {
        const isActive = activeTool === tool;
        return (
            <button
                onClick={() => setActiveTool(tool)}
                className={`flex-1 p-3 md:p-4 text-sm md:text-base font-semibold rounded-lg transition-all duration-300 flex flex-col md:flex-row items-center justify-center gap-2 ${
                    isActive
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
            >
                {icon}
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="bg-gray-100 min-h-screen font-sans text-gray-900">
            <header className="bg-white shadow-md">
                <div className="container mx-auto px-4 py-4 md:py-6">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-center text-gray-800">
                        Legal AI Toolkit
                    </h1>
                    <p className="text-center text-gray-500 mt-2">
                        Your AI-Powered Assistant for Contract Analysis & Generation
                    </p>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-8">
                <div className="bg-white p-2 md:p-3 rounded-xl shadow-md mb-8 max-w-3xl mx-auto">
                    <nav className="flex space-x-2">
                        <NavButton tool="extractor" label="Clause Extractor" icon={<DocumentIcon />} />
                        <NavButton tool="comparer" label="Version Comparison" icon={<CompareIcon />} />
                        <NavButton tool="generator" label="Contract Generator" icon={<GenerateIcon />} />
                    </nav>
                </div>

                <div className="max-w-5xl mx-auto">
                    {renderTool()}
                </div>
            </main>

            <footer className="text-center py-6 mt-8">
                <p className="text-gray-500 text-sm">
                    Final Year Project | B.Sc. (Data Science) LL.B. (Hons)
                </p>
                 <p className="text-gray-400 text-xs mt-1">
                    Disclaimer: This tool is for academic and demonstrative purposes only. Not for professional use.
                </p>
            </footer>
        </div>
    );
}
