const API="https://mempool.space/api";
let currentData=null;

async function startInvestigation(){
    const input=document.getElementById("walletInput");
    const button=document.getElementById("trackBtn");
    const status=document.getElementById("status");
    const results=document.getElementById("results");
    const address=input.value.trim();

    if(!address){alert("Please enter a Bitcoin wallet address.");input.focus();return;}

    button.disabled=true;
    button.textContent="Loading live blockchain data...";
    status.classList.add("show");
    status.textContent="Connecting to Bitcoin blockchain explorer...";

    try{
        const validation=await fetch(`${API}/v1/validate-address/${encodeURIComponent(address)}`);
        if(!validation.ok) throw new Error("Unable to validate address.");
        const validationData=await validation.json();
        if(!validationData.isvalid) throw new Error("Invalid Bitcoin address.");

        status.textContent="Fetching wallet statistics...";
        const addressResponse=await fetch(`${API}/address/${encodeURIComponent(address)}`);
        if(!addressResponse.ok) throw new Error("Wallet data could not be loaded.");
        const addressData=await addressResponse.json();

        status.textContent="Fetching recent transactions...";
        const txResponse=await fetch(`${API}/address/${encodeURIComponent(address)}/txs`);
        if(!txResponse.ok) throw new Error("Transaction history could not be loaded.");
        const transactions=await txResponse.json();

        currentData={address,addressData,transactions};
        renderResults(address,addressData,transactions);
        status.textContent="✓ Live blockchain data loaded successfully.";
        results.classList.add("show");
        results.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){
        status.textContent="❌ "+error.message;
        results.classList.remove("show");
    }finally{
        button.disabled=false;
        button.textContent="Start Live Investigation";
    }
}

function renderResults(address,data,transactions){
    const chain=data.chain_stats||{};
    const confirmedTx=chain.tx_count||0;
    const totalReceived=(chain.funded_txo_sum||0)/100000000;
    const totalSent=(chain.spent_txo_sum||0)/100000000;
    const balance=totalReceived-totalSent;

    document.getElementById("walletAddress").textContent=address;
    document.getElementById("sourceWallet").textContent=shorten(address);
    document.getElementById("txCount").textContent=confirmedTx;
    document.getElementById("received").textContent=formatBTC(totalReceived);
    document.getElementById("sent").textContent=formatBTC(totalSent);
    document.getElementById("balance").textContent=formatBTC(balance);

    renderTransactions(transactions,address);
    renderAnalysis(data,transactions);
    generateReport(address,data,transactions);
}

function renderTransactions(transactions,address){
    const table=document.getElementById("transactionTable");
    table.innerHTML="";
    if(!transactions.length){
        table.innerHTML=`<tr><td colspan="5">No transactions found.</td></tr>`;
        return;
    }

    transactions.slice(0,25).forEach(tx=>{
        const received=tx.vout.filter(output=>output.scriptpubkey_address===address).reduce((sum,output)=>sum+output.value,0);
        const sent=tx.vin.filter(input=>input.prevout&&input.prevout.scriptpubkey_address===address).reduce((sum,input)=>sum+(input.prevout.value||0),0);
        const amount=Math.abs(received-sent)/100000000;
        const fee=(tx.fee||0)/100000000;
        let time="Unconfirmed";
        if(tx.status&&tx.status.block_time) time=new Date(tx.status.block_time*1000).toLocaleString();
        const status=tx.status&&tx.status.confirmed?"Confirmed":"Unconfirmed";
        const row=document.createElement("tr");
        row.innerHTML=`<td class="txid">${shorten(tx.txid,16)}</td><td>${status}</td><td>${time}</td><td>${amount.toFixed(8)} BTC</td><td>${fee.toFixed(8)} BTC</td>`;
        table.appendChild(row);
    });
    document.getElementById("txWallets").textContent=transactions.length+" transactions";
}

function renderAnalysis(data,transactions){
    const chain=data.chain_stats||{};
    const received=(chain.funded_txo_sum||0)/100000000;
    const sent=(chain.spent_txo_sum||0)/100000000;
    const balance=received-sent;
    const confirmed=chain.tx_count||0;
    let recentUnconfirmed=0;
    transactions.forEach(tx=>{if(!tx.status||!tx.status.confirmed)recentUnconfirmed++;});

    let text="";
    text+="Confirmed transaction count: "+confirmed+"\n";
    text+="Total received: "+received.toFixed(8)+" BTC\n";
    text+="Total sent: "+sent.toFixed(8)+" BTC\n";
    text+="Calculated current balance: "+balance.toFixed(8)+" BTC\n";
    text+="Transactions returned by API: "+transactions.length+"\n";
    text+="Unconfirmed transactions in returned set: "+recentUnconfirmed+"\n\n";
    text+="These are on-chain observations only. They are not a determination of fraud.";
    document.getElementById("analysis").textContent=text;
}

function generateReport(address,data,transactions){
    const chain=data.chain_stats||{};
    const received=(chain.funded_txo_sum||0)/100000000;
    const sent=(chain.spent_txo_sum||0)/100000000;
    const balance=received-sent;

    const report=`TRACECHAIN:AI
LIVE BITCOIN INVESTIGATION REPORT
========================================

WALLET ADDRESS
${address}

NETWORK
Bitcoin Mainnet

----------------------------------------
BLOCKCHAIN DATA
----------------------------------------

CONFIRMED TRANSACTIONS
${chain.tx_count||0}

TOTAL RECEIVED
${received.toFixed(8)} BTC

TOTAL SENT
${sent.toFixed(8)} BTC

CALCULATED BALANCE
${balance.toFixed(8)} BTC

TRANSACTIONS RETURNED
${transactions.length}

----------------------------------------
DATA SOURCE
----------------------------------------

Mempool.space public Bitcoin REST API

----------------------------------------
IMPORTANT
----------------------------------------

This report contains observable
on-chain blockchain data.

It does not independently establish
fraud, criminal activity, ownership,
or intent.

========================================
TRACECHAIN:AI
========================================`;
    document.getElementById("report").textContent=report;
}

function downloadReport(){
    if(!currentData){alert("Run an investigation first.");return;}
    const report=document.getElementById("report").textContent;
    const blob=new Blob([report],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download="TraceChain_Live_Investigation.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function formatBTC(value){return value.toFixed(8)+" BTC";}

function shorten(value,length=12){
    if(value.length<=length*2)return value;
    return value.substring(0,length)+"..."+value.substring(value.length-length);
}