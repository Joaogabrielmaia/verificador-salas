const sessionKey = "app_session_ok";
const sessionExpiryKey = "app_session_expiry";
const triesKey = "app_login_tries";
const blockKey = "app_login_block_until";
const SESSION_DURATION = 2 * 60 * 60 * 1000;

function isLogged() {
    try {
        const sessionOk = sessionStorage.getItem(sessionKey) === "1";
        const expiry = parseInt(sessionStorage.getItem(sessionExpiryKey) || "0", 10);
        const now = Date.now();
        if (sessionOk && now < expiry) {
            return true;
        } else {
            if (sessionOk) {
                console.log("Sessão expirada");
            }
            logout();
            return false;
        }
    } catch (error) {
        console.error("Erro ao verificar login:", error);
        return false;
    }
}

function startSession() {
    const expiry = Date.now() + SESSION_DURATION;
    sessionStorage.setItem(sessionKey, "1");
    sessionStorage.setItem(sessionExpiryKey, expiry.toString());
    console.log("Sessão iniciada - Expira em:", new Date(expiry));
}

async function ensureDefaultPwd() {
    try {
        const resp = await fetch('/api/auth/ensure-default', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!resp.ok) {
            console.error('Erro ao garantir senha padrão no servidor:', resp.status);
        }
    } catch (error) {
        console.error('Erro de rede ao garantir senha padrão:', error);
    }
}

async function checkPassword(pass) {
    try {
        const resp = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
        });
        if (!resp.ok) return false;
        const j = await resp.json();
        return !!j.success;
    } catch (error) {
        console.error('Erro de rede ao verificar senha no servidor:', error);
        return false;
    }
}

async function attemptLogin() {
    console.log("Tentando login...");

    const input = document.getElementById("lockPwd");
    const msg = document.getElementById("lockMsg");
    const btn = document.getElementById("btnLockEnter");

    if (!input || !msg) {
        console.error("Elementos do login não encontrados");
        return;
    }

    const pass = input.value || "";

    if (!pass) {
        msg.textContent = "Digite a senha";
        msg.style.color = "#ef4444";
        input.focus();
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat me-2"></i>Verificando...';

    try {
        await ensureDefaultPwd();

        const now = Date.now();
        const blockUntil = parseInt(localStorage.getItem(blockKey) || "0", 10);

        if (now < blockUntil) {
            const wait = Math.ceil((blockUntil - now) / 1000);
            msg.textContent = `Aguarde ${wait}s para tentar novamente`;
            msg.style.color = "#ef4444";
            input.value = "";
            return;
        }

        let tries = parseInt(localStorage.getItem(triesKey) || "0", 10);
        const ok = await checkPassword(pass);

        if (ok) {
            startSession();
            localStorage.setItem(triesKey, "0");
            msg.textContent = "Login realizado com sucesso!";
            msg.style.color = "#16a34a";
            setTimeout(() => {
                const lockEl = document.getElementById("lock");
                if (lockEl) lockEl.classList.add("hidden");
                msg.textContent = "";
                input.value = "";
                window.location.reload();
            }, 1000);
        } else {
            tries++;
            localStorage.setItem(triesKey, String(tries));
            msg.textContent = `Senha incorreta (${tries}/3 tentativas)`;
            msg.style.color = "#ef4444";
            input.value = "";
            input.focus();
            if (tries >= 3) {
                localStorage.setItem(blockKey, String(Date.now() + 30000));
                localStorage.setItem(triesKey, "0");
                msg.textContent = "Bloqueado por 30 segundos";
            }
        }
    } catch (error) {
        console.error("Erro no login:", error);
        msg.textContent = "Erro ao fazer login";
        msg.style.color = "#ef4444";
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-unlock-fill me-2"></i>Entrar no Sistema';
    }
}

function logout() {
    sessionStorage.removeItem(sessionKey);
    sessionStorage.removeItem(sessionExpiryKey);
    const lockElement = document.getElementById("lock");
    if (lockElement) {
        lockElement.classList.remove("hidden");
    }
    console.log("Logout realizado");
}

function bindPwdToggle() {
    const btn = document.getElementById("btnPwdToggle");
    const inp = document.getElementById("lockPwd");
    console.log("Procurando elementos:", { btn: !!btn, inp: !!inp });
    if (!btn || !inp) {
        console.error("Elementos do toggle de senha não encontrados");
        return;
    }
    btn.addEventListener("click", () => {
        const show = inp.type === "password";
        inp.type = show ? "text" : "password";
        const icon = btn.querySelector("i");
        if (icon) {
            icon.className = show ? "bi bi-eye-slash" : "bi bi-eye";
        }
        inp.focus();
        const len = inp.value.length;
        inp.setSelectionRange(len, len);
        console.log("Senha visível:", show);
    });
    console.log("Toggle de senha configurado");
}

function protectPage() {
    if (!isLogged()) {
        console.log("Página protegida - usuário não logado");
        const lockElement = document.getElementById("lock");
        if (lockElement) {
            lockElement.classList.remove("hidden");
        }
        return false;
    }
    console.log("Página protegida - usuário logado");
    return true;
}

function initSecuritySystem() {
    console.log("Iniciando sistema de segurança...");
    if (!protectPage()) {
        console.log("Usuário não autenticado, mostrando tela de login");
    } else {
        console.log("Usuário autenticado, escondendo tela de login");
        const lock = document.getElementById("lock");
        if (lock) lock.classList.add("hidden");
    }

    const btnLockEnter = document.getElementById("btnLockEnter");
    const lockPwd = document.getElementById("lockPwd");

    if (btnLockEnter) {
        btnLockEnter.addEventListener("click", attemptLogin);
        console.log("Botão de login configurado");
    } else {
        console.error("Botão btnLockEnter não encontrado");
    }

    if (lockPwd) {
        lockPwd.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                attemptLogin();
            }
        });
        console.log("Campo de senha configurado");
    } else {
        console.error("Campo lockPwd não encontrado");
    }

    const logoutButtons = document.querySelectorAll('[id*="btnLogout"]');
    logoutButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            logout();
        });
    });

    setTimeout(() => {
        bindPwdToggle();
    }, 100);

    console.log("Sistema de segurança inicializado");
}

document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM Carregado - Iniciando segurança");
    initSecuritySystem();
});

console.log("Sistema de segurança carregado");
