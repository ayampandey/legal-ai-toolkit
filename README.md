# Legal AI Toolkit

This project is a web-based "Legal AI Toolkit" designed as a final year project for a B.Sc. (Data Science) and LL.B. (Hons) program. It integrates three core legal tech tools into a single, user-friendly interface to demonstrate the practical application of AI in the legal field.

## ✨ Features

This toolkit includes three main components:

1.  **Intelligent Clause Extractor:** Paste the text of a contract, and the tool uses AI to identify, extract, and summarize key clauses such as Limitation of Liability, Confidentiality, and Governing Law.
2.  **Contract Version Comparison:** Upload two versions of a contract, and the tool provides a "diff" style comparison, clearly highlighting what has been added, removed, or changed between the documents.
3.  **Basic Contract Generation Assistant:** Generate a basic draft for common legal documents (like a Non-Disclosure Agreement) by providing key details. The tool creates a template with placeholders for customization.

## 🛠️ Tech Stack

* **Frontend:** React.js
* **Styling:** Tailwind CSS
* **AI/LLM:** Google Gemini API

---

## 🚀 Getting Started

To run this project locally, please follow these steps:

### Prerequisites

* Node.js and npm installed on your machine.
* A Google Gemini API key. You can get one for free from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/YOUR_USERNAME/legal-ai-toolkit.git](https://github.com/YOUR_USERNAME/legal-ai-toolkit.git)
    cd legal-ai-toolkit
    ```
    *(Remember to replace `YOUR_USERNAME` with your actual GitHub username)*

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up your environment variables:**
    * In the root folder, make a copy of the `.env.example` file and rename it to `.env`.
    * Open the new `.env` file.
    * Add your Google Gemini API key to this file:
        ```
        REACT_APP_GEMINI_API_KEY=your-actual-api-key-goes-here
        ```

4.  **Run the application:**
    ```bash
    npm start
    ```

The application will now be running at `http://localhost:3000`.

---

### Disclaimer

This is an academic project for demonstration purposes only and should not be used for actual legal work. The AI-generated content may not be accurate or legally binding. Always consult with a qualified legal professional.