// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let extractedText = "";

// Tab Switch Logic
function switchTab(tab) {
    const pdfSec = document.getElementById('sectionPdf');
    const textSec = document.getElementById('sectionText');
    const tabPdfBtn = document.getElementById('tabPdf');
    const tabTextBtn = document.getElementById('tabText');

    if (tab === 'pdf') {
        pdfSec.classList.remove('hidden');
        textSec.classList.add('hidden');
        tabPdfBtn.className = "pb-2 px-4 font-medium border-b-2 border-blue-600 text-blue-600";
        tabTextBtn.className = "pb-2 px-4 font-medium text-slate-500 hover:text-slate-700";
    } else {
        pdfSec.classList.add('hidden');
        textSec.classList.remove('hidden');
        tabTextBtn.className = "pb-2 px-4 font-medium border-b-2 border-blue-600 text-blue-600";
        tabPdfBtn.className = "pb-2 px-4 font-medium text-slate-500 hover:text-slate-700";
    }
}

// Read text from PDF File
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        alert('অনুগ্রহ করে একটি সঠিক PDF ফাইল নির্বাচন করুন।');
        return;
    }

    document.getElementById('fileName').innerText = file.name + " (টেক্সট নিষ্কাশন হচ্ছে...)";
    document.getElementById('fileInfo').classList.remove('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        // Read up to first 15-20 pages to avoid context overflow if large book
        const maxPages = Math.min(pdf.numPages, 20);
        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
        }

        extractedText = fullText;
        document.getElementById('fileName').innerText = `${file.name} (সফলভাবে পড়া হয়েছে - ${maxPages} পৃষ্ঠা)`;
    } catch (err) {
        console.error(err);
        alert('PDF ফাইলটি থেকে পড়া সম্ভব হয়নি। পেস্ট অপশন ব্যবহার করুন।');
    }
}

// Generate Questions via Gemini API
async function generateQuestions() {
    const apiKey = document.getElementById('apiKey').value.trim();
    if (!apiKey) {
        alert('অনুগ্রহ করে আপনার Gemini API Key প্রদান করুন।');
        return;
    }

    // Determine text content source
    const textInputVal = document.getElementById('textInput').value.trim();
    const contentText = textInputVal.length > 0 ? textInputVal : extractedText;

    if (!contentText || contentText.length < 50) {
        alert('প্রশ্ন তৈরি করার জন্য পর্যাপ্ত টেক্সট পাওয়া যায়নি। PDF আপলোড করুন অথবা বক্সে লিখা পেস্ট করুন।');
        return;
    }

    const type = document.getElementById('questionType').value;
    const count = document.getElementById('questionCount').value;
    const targetClass = document.getElementById('targetClass').value || 'নবম-দশম শ্রেণি';

    // UI elements update
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('outputContainer').classList.add('hidden');

    // Prompt construction for NCTB / Board Standard Questions
    let promptInstruction = "";
    if (type === 'cq') {
        promptInstruction = `প্রদত্ত পাঠ্যবইয়ের অনুচ্ছেদ বা বিষয়বস্তুর ওপর ভিত্তি করে বাংলাদেশের শিক্ষা বোর্ডের (NCTB) কারিকুলাম ও মান অনুসারে মোট ${count} টি সৃজনশীল প্রশ্ন (CQ) তৈরি করুন। 
প্রতিটি প্রশ্নের জন্য একটি উপযুক্ত উদ্দীপক থাকবে এবং নিচে ক, খ, গ, ঘ এই ৪টি প্রশ্ন থাকবে (ক=জ্ঞানমূলক, খ=অনুধাবনমূলক, গ=প্রয়োগমূলক, ঘ=উচ্চতর চিন্তাধন)। সবশেষে সংক্ষিপ্ত উত্তর সংকেত বা গাইডলাইন দিন।`;
    } else if (type === 'mcq') {
        promptInstruction = `প্রদত্ত পাঠ্যবইয়ের অনুচ্ছেদ থেকে মাধ্যমিক শিক্ষা বোর্ডের মান অনুযায়ী মোট ${count * 5} টি বহু-নির্বাচনী প্রশ্ন (MCQ) তৈরি করুন। 
প্রতিটি প্রশ্নের ৪টি করে অপশন (ক, খ, গ, ঘ) থাকবে। সব প্রশ্নের শেষে সঠিক উত্তর এবং এক লাইনের ব্যাখ্যা যুক্ত করে দিন।`;
    } else {
        promptInstruction = `প্রদত্ত পাঠ্যবইয়ের বিষয়বস্তুর ওপর ভিত্তি করে মাধ্যমিক শিক্ষা বোর্ডের মান অনুযায়ী ${count} টি সৃজনশীল প্রশ্ন (উদ্দীপক সহ ক, খ, গ, ঘ) এবং ৫টি বহু-নির্বাচনী প্রশ্ন (MCQ - উত্তর ও অপশনসহ) তৈরি করুন।`;
    }

    const systemPrompt = `আপনি একজন অভিজ্ঞ জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (NCTB) এর প্রশ্নপ্রণেতা। আপনার কাজ নিচে দেওয়া পাঠ্যবইয়ের লেখা থেকে বোর্ড পরীক্ষার উপযোগী মানসম্পন্ন প্রশ্নপত্র তৈরি করা। 

শ্রেণি/মান: ${targetClass}
নির্দেশনা: ${promptInstruction}

পাঠ্যবইয়ের বিষয়বস্তু:
"""
${contentText.substring(0, 10000)}
"""`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        const resultText = data.candidates[0].content.parts[0].text;
        
        // Render Output
        document.getElementById('questionArea').innerHTML = formatMarkdown(resultText);
        document.getElementById('outputContainer').classList.remove('hidden');
    } catch (error) {
        console.error(error);
        alert('প্রশ্ন তৈরি করতে সমস্যা হয়েছে: ' + error.message);
    } finally {
        document.getElementById('loader').classList.add('hidden');
    }
}

// Simple Helper function to format basic markdown to HTML
function formatMarkdown(text) {
    let formatted = text
        .replace(/\n\n/g, '<br><br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/### (.*?)(<br>|\n)/g, '<h3 class="text-xl font-bold text-blue-800 mt-4 mb-2">$1</h3>')
        .replace(/## (.*?)(<br>|\n)/g, '<h2 class="text-2xl font-bold text-blue-900 mt-6 mb-3 border-b pb-1">$1</h2>');
    return formatted;
}

// Utility: Copy text
function copyQuestions() {
    const qArea = document.getElementById('questionArea').innerText;
    navigator.clipboard.writeText(qArea);
    alert('প্রশ্নগুলো ক্লিপবোর্ডে কপি করা হয়েছে!');
}

// Utility: Print
function printQuestions() {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>বোর্ড প্রশ্নপত্র</title>');
    printWindow.document.write('<style>body{font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(document.getElementById('questionArea').innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}
