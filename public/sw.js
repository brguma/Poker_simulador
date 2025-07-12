const CACHE_NAME = 'poker-trainer-v1.2.0';
const OFFLINE_URL = '/public/offline.html';

// Arquivos essenciais para cache
const ESSENTIAL_FILES = [
  '/',
  '/src/index.html',
  '/src/style.css',
  '/src/app.js',
  '/public/manifest.json',
  '/public/offline.html',
  '/public/icons/icon-192x192.png',
  '/public/icons/icon-512x512.png'
];

// Recursos CDN para cache
const CDN_RESOURCES = [
  'https://cdn.tailwindcss.com/3.3.0',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/recharts/2.8.0/Recharts.js'
];

// Todos os arquivos para cache inicial
const CACHE_FILES = [...ESSENTIAL_FILES, ...CDN_RESOURCES];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Instalando versão', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Abrindo cache:', CACHE_NAME);
        
        // Cache arquivos essenciais primeiro
        return cache.addAll(ESSENTIAL_FILES)
          .then(() => {
            console.log('✅ Arquivos essenciais cacheados');
            
            // Tentar cachear CDN (não crítico se falhar)
            return Promise.allSettled(
              CDN_RESOURCES.map(url => 
                fetch(url).then(response => {
                  if (response.ok) {
                    return cache.put(url, response.clone());
                  }
                }).catch(err => console.log('⚠️ CDN cache falhou:', url))
              )
            );
          });
      })
      .then(() => {
        console.log('✅ Cache inicial criado com sucesso');
        return self.skipWaiting(); // Ativa imediatamente
      })
      .catch((error) => {
        console.error('❌ Erro ao criar cache inicial:', error);
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Ativando versão', CACHE_NAME);
  
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Tomar controle de todas as páginas
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker ativado e controlando todas as páginas');
      
      // Notificar clientes sobre nova versão
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CACHE_NAME
          });
        });
      });
    })
  );
});

// Interceptação de requisições (Estratégia: Cache First com Network Fallback)
self.addEventListener('fetch', (event) => {
  // Ignorar requisições não-GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar extensões do browser
  if (event.request.url.includes('extension://')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Se está no cache, retorna
        if (cachedResponse) {
          console.log('📦 Cache hit:', event.request.url);
          
          // Para arquivos essenciais, também busca na rede em background para atualizar
          if (ESSENTIAL_FILES.some(file => event.request.url.includes(file))) {
            fetch(event.request)
              .then(response => {
                if (response && response.status === 200) {
                  caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, response.clone());
                  });
                }
              })
              .catch(() => {}); // Background update, não importa se falhar
          }
          
          return cachedResponse;
        }
        
        // Se não está no cache, busca na rede
        return fetch(event.request)
          .then((response) => {
            // Verifica se a resposta é válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clona a resposta para o cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Cachear apenas recursos do nosso domínio ou CDNs conhecidos
                if (shouldCache(event.request.url)) {
                  cache.put(event.request, responseToCache);
                  console.log('💾 Novo arquivo cacheado:', event.request.url);
                }
              });
            
            console.log('🌐 Network response:', event.request.url);
            return response;
          })
          .catch((error) => {
            console.log('❌ Network failed para:', event.request.url);
            
            // Se é uma navegação, retorna página offline
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            
            // Para outros recursos, tenta fallbacks
            if (event.request.destination === 'image') {
              return new Response('', { status: 200, statusText: 'OK' });
            }
            
            return new Response('', { status: 408, statusText: 'Offline' });
          });
      })
  );
});

// Função para decidir se deve cachear um recurso
function shouldCache(url) {
  const urlObj = new URL(url);
  
  // Sempre cachear recursos do nosso domínio
  if (urlObj.origin === self.location.origin) {
    return true;
  }
  
  // Cachear CDNs conhecidos
  const allowedCDNs = [
    'cdnjs.cloudflare.com',
    'cdn.tailwindcss.com',
    'unpkg.com'
  ];
  
  return allowedCDNs.some(cdn => urlObj.hostname.includes(cdn));
}

// Limpeza periódica do cache
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAN_CACHE') {
    cleanOldCache();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    getCacheSize().then(size => {
      event.ports[0].postMessage({ cacheSize: size });
    });
  }
});

// Função para limpar cache antigo
function cleanOldCache() {
  caches.open(CACHE_NAME)
    .then(cache => {
      return cache.keys();
    })
    .then(requests => {
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias
      
      return Promise.all(
        requests.map(request => {
          return cache.match(request).then(response => {
            const dateHeader = response.headers.get('date');
            if (dateHeader) {
              const responseDate = new Date(dateHeader).getTime();
              if (now - responseDate > maxAge) {
                console.log('🗑️ Removendo cache expirado:', request.url);
                return cache.delete(request);
              }
            }
          });
        })
      );
    });
}

// Função para calcular tamanho do cache
async function getCacheSize() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  let totalSize = 0;
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }
  
  return totalSize;
}

// Background Sync (quando disponível)
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
      event.waitUntil(
        // Sincronizar dados quando voltar online
        syncGameData()
      );
    }
  });
}

// Função para sincronizar dados do jogo
async function syncGameData() {
  try {
    // Aqui você pode implementar sincronização de dados
    // Por exemplo, enviar estatísticas para um servidor
    console.log('🔄 Sincronizando dados do jogo...');
    
    // Simular sincronização
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Dados sincronizados');
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
  }
}

// Notificações Push (quando disponível)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Volte a treinar no Poker Trainer!',
    icon: '/public/icons/icon-192x192.png',
    badge: '/public/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir App',
        icon: '/public/icons/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/public/icons/icon-192x192.png'
      }
    ],
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification('Poker Trainer', options)
  );
});

// Click em notificações
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('🎯 Service Worker carregado - versão:', CACHE_NAME);