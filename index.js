const VALID_USERS = [
    { id: "secret", pw: "12342234", name: "管理人" },
    { id: "pilot1", pw: "abcd1234", name: "パイロットA" }
];

function handleLogin(event) {
    event.preventDefault();
    
    const idInput = document.getElementById('username').value.trim();
    const pwInput = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('error-msg');

    const matchedUser = VALID_USERS.find(user => user.id === idInput && user.pw === pwInput);

    if (matchedUser) {
        errorMsg.style.display = 'none';
        
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('loginUserId', matchedUser.id);
        sessionStorage.setItem('loginUserName', matchedUser.name);
        
        if (!localStorage.getItem('secret_user_account')) {
            localStorage.setItem('secret_user_account', JSON.stringify({
                name: matchedUser.name,
                avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + matchedUser.id
            }));
        }

        goToMain();
    } else {
        errorMsg.style.display = 'block';
    }
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    const header = document.getElementById('main-header');
    const secretCard = document.getElementById('secret-card');

    if (pageId === 'main-page') {
        header.style.display = 'flex';
        
        setTimeout(() => {
            if (secretCard) {
                secretCard.style.display = 'flex';
                setTimeout(() => {
                    secretCard.style.opacity = '1';
                    secretCard.style.transform = 'translateY(0)';
                }, 50);
            }
        }, 10000);

    } else {
        header.style.display = 'none';
        if (secretCard) {
            secretCard.style.display = 'none';
            secretCard.style.opacity = '0';
            secretCard.style.transform = 'translateY(20px)';
        }
    }
    window.scrollTo(0, 0);
    
    if (window.goatcounter) goatcounter.count({ path: '/#' + pageId });
}

function goToMain() { 
    location.hash = "main"; 
    showPage('main-page'); 
}

function checkAuthAndRoute() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    
    if (window.location.hash === '#main') {
        if (isLoggedIn) {
            showPage('main-page');
        } else {
            location.hash = ""; 
            showPage('top-page');
        }
    } else {
        showPage('top-page');
    }
}

window.onload = checkAuthAndRoute;
window.onhashchange = checkAuthAndRoute;
