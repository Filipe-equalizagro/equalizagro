'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Plus, Menu, X, LogOut, Trash2, Archive, Search, User, Pencil, Leaf, FileDown, ThumbsDown, Copy, Check } from 'lucide-react';
import { getAuthToken, getUserId, logout, verifySession } from '@/lib/auth';
import './ConsultorIA.css';

// Função para formatar markdown básico em HTML
function formatMessageContent(content: string): string {
  let formatted = content;

  // Extrair blocos de código antes de escapar HTML
  const codeBlocks: string[] = [];
  formatted = formatted.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre class="consultor__code-block"><code>${code.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`);
    return `%%CODEBLOCK_${idx}%%`;
  });

  // Escapar HTML do restante
  formatted = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Converter **texto** em negrito
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Converter *texto* em itálico
  formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Detectar linhas que são itens de tabela (começam e terminam com |)
  const lines = formatted.split('\n');
  let inTable = false;
  let tableLines: string[] = [];
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 1) Opção de menu (prioridade sobre tabela) — número isolado + texto.
    //    Cobre "| 1 | Sim", "| 1 | Sim |", "1 | Sim", "1) Sim", "1. Sim"…
    const option = parseMenuOption(line);
    if (option) {
      if (inTable && tableLines.length > 0) {
        result.push(convertTableToHtml(tableLines));
        inTable = false;
        tableLines = [];
      }
      result.push(menuOptionHtml(option.num, option.text));
      continue;
    }

    // 2) Linha de tabela (markdown com múltiplas colunas de texto)
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableLines = [];
      }
      tableLines.push(line);
    } else {
      // Se estávamos em uma tabela, fechar ela
      if (inTable && tableLines.length > 0) {
        result.push(convertTableToHtml(tableLines));
        inTable = false;
        tableLines = [];
      }

      // Processar linha normal
      if (line) {
        result.push(`<p class="consultor__formatted-paragraph">${line}</p>`);
      } else {
        result.push('<br/>');
      }
    }
  }
  
  // Se terminou ainda em tabela
  if (inTable && tableLines.length > 0) {
    result.push(convertTableToHtml(tableLines));
  }

  let output = result.join('');

  // Restaurar blocos de código
  codeBlocks.forEach((block, idx) => {
    output = output.replace(`<p class="consultor__formatted-paragraph">%%CODEBLOCK_${idx}%%</p>`, block);
    output = output.replace(`%%CODEBLOCK_${idx}%%`, block);
  });

  return output;
}

/**
 * Detecta uma linha de opção de menu (1, 2, 9, 0…) em vários formatos:
 *   "| 1 | Sim"   "| 1 | Sim |"   "1 | Sim"   "1) Sim"   "1. Sim"   "1 - Sim"
 * Retorna { num, text } ou null. NÃO captura linhas de tabela normais
 * (cuja primeira célula não é um número isolado) nem doses tipo "1,0 L/ha".
 */
function parseMenuOption(line: string): { num: string; text: string } | null {
  // Forma com pipe — primeira célula é só um número
  let m = line.match(/^\|{0,2}\s*(\d{1,2})\s*\|\s*(.+?)\s*\|?\s*$/);
  if (m) return { num: m[1], text: m[2].replace(/\|/g, ' ').replace(/\s+/g, ' ').trim() };
  // Forma com pontuação — "1) Sim", "1. Sim", "1 - Sim", "1 – Sim"
  m = line.match(/^(\d{1,2})\s*[).\-–]\s+(.+)$/);
  if (m) return { num: m[1], text: m[2].trim() };
  return null;
}

function menuOptionHtml(num: string, text: string): string {
  return `<div class="consultor__formatted-item consultor__formatted-item--option" data-option="${num}" role="button" tabindex="0"><span class="consultor__item-number">${num}</span><span class="consultor__item-content">${text}</span></div>`;
}

function convertTableToHtml(tableLines: string[]): string {
  const rows = tableLines.map(line => {
    const cells = line.split('|').filter(cell => cell.trim() !== '');
    return cells.map(cell => cell.trim());
  });
  
  if (rows.length === 0) return '';
  
  // Verificar se a segunda linha é separador (---)
  const hasSeparator = rows.length > 1 && rows[1].every(cell => /^-+$/.test(cell.trim()));
  
  let html = '<div class="consultor__table-wrapper"><table class="consultor__table">';
  
  if (hasSeparator && rows.length > 0) {
    // Primeira linha como cabeçalho
    html += '<thead><tr>';
    rows[0].forEach(cell => {
      html += `<th>${cell}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Resto como corpo (pular separador)
    for (let i = 2; i < rows.length; i++) {
      html += '<tr>';
      rows[i].forEach(cell => {
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    }
    html += '</tbody>';
  } else {
    // Sem cabeçalho, tudo como corpo
    html += '<tbody>';
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
  }
  
  html += '</table></div>';
  return html;
}

// Componente para mensagem formatada
function FormattedMessage({ content, role, onOptionClick }: { content: string; role: 'user' | 'assistant'; onOptionClick?: (value: string) => void }) {
  const formattedHtml = useMemo(() => {
    if (role === 'user') {
      return content;
    }
    return formatMessageContent(content);
  }, [content, role]);

  if (role === 'user') {
    return <p className="consultor__message-text">{content}</p>;
  }

  // Delegação de clique: quando o usuário clica numa opção numerada
  // (1, 2, 9, 0…), envia esse número como resposta automaticamente.
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onOptionClick) return;
    const el = (e.target as HTMLElement).closest('[data-option]');
    if (el) {
      const value = el.getAttribute('data-option');
      if (value) {
        e.stopPropagation();
        onOptionClick(value);
      }
    }
  };

  return (
    <div
      className="consultor__message-text consultor__message-formatted"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  messages: Message[];
  isArchived?: boolean;
  lastMessageAt?: Date;
}

interface PlanData {
  planName: string;
  creditsAvailable: number;
  creditsUsed: number;
  monthlyLimit: number;
  renewalDate: Date;
  fullName?: string;
  email?: string;
  userId?: string;
}

function createWelcomeAssistantMessages(): Message[] {
  const ts = new Date();
  return [
    {
      id: '1',
      role: 'assistant',
      content: `Olá! Sou o **Consultor.IA**, estou aqui para ajudar a converter nosso banco de dados em caldas de qualidade.

ℹ️ **Dicas de uso:**

• Para reiniciar ou refazer a qualquer momento, escreva **reiniciar**

• Após confirmar os produtos, farei algumas perguntas rápidas — é parte do protocolo

• Se um ou mais produtos não forem encontrados na web ou na base de dados, vou pedir informações

• Informe os produtos que você pretende misturar e as respectivas doses. Lembre de utilizar sempre a marca comercial, ou uma marca referência.

ProdutoA 1,0 l/ha
ProdutoB 0,5 l/ha
...`,
      timestamp: ts,
    },
  ];
}

/** ID vindo do PostgreSQL (mensagem persistida no banco) */
function isPersistedMessageId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

export default function ConsultorIA() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMobileDevice = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [userName, setUserName] = useState<string>(() => {
    try { return localStorage.getItem('userName') || ''; } catch { return ''; }
  });
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [gptContextId, setGptContextId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [timeUntilSend, setTimeUntilSend] = useState<number>(0);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [dislikedMessageIds, setDislikedMessageIds] = useState<Set<string>>(new Set());
  // Modo de seleção de mensagens para exportar apenas as escolhidas
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingMessagesRef = useRef<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const isSendingRef = useRef<boolean>(false);
  const currentConversationIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const isLoadingConversationsRef = useRef<boolean>(false);
  // Previne que loadConversations seja re-executada quando userId muda mais de uma vez
  // (checkSession + fetchPlanData disparam setUserId múltiplas vezes)
  const conversationsLoadedOnceRef = useRef<boolean>(false);
  const TYPING_DELAY = 10000; // 10 segundos de espera

  // Manter refs atualizados
  useEffect(() => {
    pendingMessagesRef.current = pendingMessages;
  }, [pendingMessages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Foco automático no input ao terminar de carregar (apenas desktop)
  useEffect(() => {
    if (!isLoading && !isMobileDevice() && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  // Restaura foco no input após a IA responder (apenas desktop)
  useEffect(() => {
    if (!isSending && !isMobileDevice() && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSending]);

  // Verificar autenticação completa ao carregar (token + 2FA + dispositivo)
  useEffect(() => {
    const checkSession = async () => {
      console.log('[ConsultorIA] Verificando sessão...');
      
      const result = await verifySession();
      
      if (!result.valid) {
        console.log('[ConsultorIA] Sessão inválida:', result.reason, result.message);
        
        // Se 2FA expirou ou dispositivo mudou, mostrar mensagem e redirecionar
        if (result.reason === '2fa_expired' || result.reason === 'device_changed') {
          setSessionError(result.message || 'Sua sessão expirou. Faça login novamente.');
          // Aguardar 2 segundos para mostrar a mensagem
          setTimeout(() => {
            logout();
            window.location.href = '/';
          }, 2500);
          return;
        }
        
        // Outros casos (sem token, token inválido), redirecionar imediatamente
        window.location.href = '/';
        return;
      }
      
      console.log('[ConsultorIA] Sessão válida para:', result.email);
      setIsAuthenticated(true);

      // Se veio userId da verificação, definir
      if (result.userId) {
        setUserId(result.userId);
      }

      // Capturar nome do usuário da sessão
      if (result.fullName) {
        setUserName(result.fullName);
      }
      
      fetchPlanData(); // Buscar dados do plano
    };
    
    checkSession();
  }, []);

  // Salvar conversa completa no localStorage
  const saveConversationToLocalStorage = (conversation: Conversation, msgs: Message[]) => {
    try {
      // Salvar mensagens da conversa
      const msgKey = `equalizagro_msgs_${conversation.id}`;
      localStorage.setItem(msgKey, JSON.stringify(msgs.map(m => ({
        ...m,
        timestamp: m.timestamp.toISOString()
      }))));

      // Salvar metadados da conversa
      const convKey = `equalizagro_conv_${conversation.id}`;
      localStorage.setItem(convKey, JSON.stringify({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
        isArchived: conversation.isArchived || false,
        lastMessageAt: new Date().toISOString(),
      }));
      
      // Atualizar índice de conversas do usuário
      const userKey = userId || 'local';
      const indexKey = `equalizagro_convs_index_${userKey}`;
      const existingIndex = JSON.parse(localStorage.getItem(indexKey) || '[]');
      if (!existingIndex.includes(conversation.id)) {
        existingIndex.unshift(conversation.id); // Adicionar no início
        localStorage.setItem(indexKey, JSON.stringify(existingIndex));
      }
      
      console.log('[LocalStorage] Conversa salva:', conversation.id);
    } catch (e) {
      console.error('[LocalStorage] Erro ao salvar conversa:', e);
    }
  };

  // Carregar todas as conversas do localStorage
  const loadConversationsFromLocalStorage = (): Conversation[] => {
    try {
      const userKey = userId || 'local';
      const indexKey = `equalizagro_convs_index_${userKey}`;
      const conversationIds = JSON.parse(localStorage.getItem(indexKey) || '[]');
      
      const conversations: Conversation[] = [];
      for (const convId of conversationIds) {
        const convKey = `equalizagro_conv_${convId}`;
        const convData = localStorage.getItem(convKey);
        if (convData) {
          const parsed = JSON.parse(convData);
          if (!parsed.isArchived) {
            conversations.push({
              id: parsed.id,
              title: parsed.title,
              createdAt: new Date(parsed.createdAt),
              messages: [],
              isArchived: parsed.isArchived,
              lastMessageAt: parsed.lastMessageAt ? new Date(parsed.lastMessageAt) : undefined,
            });
          }
        }
      }
      
      console.log('[LocalStorage] Conversas carregadas:', conversations.length);
      return conversations;
    } catch (e) {
      console.error('[LocalStorage] Erro ao carregar conversas:', e);
      return [];
    }
  };

  // Carregar mensagens do localStorage
  const loadMessagesFromLocalStorage = (conversationId: string): Message[] | null => {
    try {
      const key = `equalizagro_msgs_${conversationId}`;
      const data = localStorage.getItem(key);
      if (data) {
        const msgs = JSON.parse(data).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        console.log('[LocalStorage] Mensagens carregadas:', msgs.length);
        return msgs;
      }
    } catch (e) {
      console.error('[LocalStorage] Erro ao carregar mensagens:', e);
    }
    return null;
  };

  // Alias para compatibilidade
  const saveToLocalStorage = (conversationId: string, msgs: Message[]) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      saveConversationToLocalStorage(conv, msgs);
    } else {
      // Criar conversa temporária para salvar
      const tempConv: Conversation = {
        id: conversationId,
        title: 'Conversa',
        createdAt: new Date(),
        messages: msgs,
      };
      saveConversationToLocalStorage(tempConv, msgs);
    }
  };

  /** Remove conversa do cache local (evita “ressuscitar” após excluir no servidor) */
  const removeConversationFromLocalStorage = (conversationId: string) => {
    try {
      const userKey = userId || 'local';
      const indexKey = `equalizagro_convs_index_${userKey}`;
      localStorage.removeItem(`equalizagro_msgs_${conversationId}`);
      localStorage.removeItem(`equalizagro_conv_${conversationId}`);
      const existingIndex = JSON.parse(localStorage.getItem(indexKey) || '[]');
      const next = existingIndex.filter((id: string) => id !== conversationId);
      localStorage.setItem(indexKey, JSON.stringify(next));
    } catch (e) {
      console.error('[LocalStorage] Erro ao remover conversa:', e);
    }
  };

  const loadFromLocalStorage = loadMessagesFromLocalStorage;

  // Carregar conversas quando userId estiver disponível
  useEffect(() => {
    if (userId) {
      loadConversations();
    } else {
      // Se não conseguir carregar userId após um tempo, mostrar a interface mesmo assim
      const timeout = setTimeout(() => {
        if (!userId) {
          setIsLoading(false);
          // Criar conversa local como fallback
          const fallbackConversation: Conversation = {
            id: Date.now().toString(),
            title: 'Nova Conversa',
            createdAt: new Date(),
            messages: createWelcomeAssistantMessages(),
          };
          setConversations([fallbackConversation]);
          setCurrentConversationId(fallbackConversation.id);
          setMessages(fallbackConversation.messages);
        }
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [userId]);

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Filtrar conversas pela busca do sidebar (estilo Gemini)
  const filteredConversations = useMemo(() => {
    const list = showArchived ? archivedConversations : conversations;
    if (!sidebarSearch.trim()) return list;
    const q = sidebarSearch.trim().toLowerCase();
    return list.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, archivedConversations, showArchived, sidebarSearch]);

  // Carregar conversas salvas do banco de dados
  const loadConversations = async () => {
    if (!userId || isLoadingConversationsRef.current || conversationsLoadedOnceRef.current) {
      console.log('[ConsultorIA] loadConversations: ignorando chamada duplicada (userId:', userId, 'loading:', isLoadingConversationsRef.current, 'loaded:', conversationsLoadedOnceRef.current, ')');
      return;
    }

    conversationsLoadedOnceRef.current = true;
    isLoadingConversationsRef.current = true;
    console.log('[ConsultorIA] Carregando conversas para userId:', userId);
    setIsLoadingConversations(true);
    try {
      // Carregar conversas não arquivadas
      const response = await fetch(`/api/consultor/conversations?userId=${userId}&includeArchived=false`);
      const data = await response.json();
      
      console.log('[ConsultorIA] Resposta da API:', data);

      if (data.success && data.conversations && data.conversations.length > 0) {
        const loadedConversations: Conversation[] = data.conversations.map((conv: any) => ({
          id: conv.id,
          title: conv.title,
          createdAt: new Date(conv.createdAt),
          messages: [],
          isArchived: conv.isArchived,
          lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : undefined,
        }));
        
        console.log('[ConsultorIA] Conversas carregadas:', loadedConversations.length);

        // Carregar conversas arquivadas
        const archivedResponse = await fetch(`/api/consultor/conversations?userId=${userId}&includeArchived=true`);
        const archivedData = await archivedResponse.json();

        if (archivedData.success) {
          const archived = archivedData.conversations
            .filter((conv: any) => conv.isArchived)
            .map((conv: any) => ({
              id: conv.id,
              title: conv.title,
              createdAt: new Date(conv.createdAt),
              messages: [],
              isArchived: true,
            }));
          setArchivedConversations(archived);
        }

        setConversations(loadedConversations);
        // Selecionar a primeira conversa (mais recente)
        const firstConv = loadedConversations[0];
        setCurrentConversationId(firstConv.id);
        setGptContextId(null);
        // Carregar mensagens da primeira conversa
        await loadMessages(firstConv.id);
      } else {
        // Banco não tem conversas: criar sempre uma nova no banco (garante rastreamento)
        console.log('[ConsultorIA] Nenhuma conversa no banco, criando nova...');
        await createNewConversation();
      }
    } catch (error) {
      console.error('[ConsultorIA] Erro ao carregar conversas:', error);
      await createNewConversation();
    } finally {
      setIsLoadingConversations(false);
      setIsLoading(false);
      isLoadingConversationsRef.current = false;
    }
  };

  // Carregar mensagens de uma conversa específica
  const loadMessages = async (conversationId: string) => {
    if (!userId) {
      console.log('[ConsultorIA] loadMessages: userId não disponível');
      return;
    }

    console.log('[ConsultorIA] Carregando mensagens da conversa:', conversationId);
    setIsLoadingMessages(true);
    try {
      const response = await fetch(
        `/api/consultor/conversations/messages?conversationId=${conversationId}&userId=${userId}`
      );
      const data = await response.json();

      console.log('[ConsultorIA] Mensagens carregadas:', data);

      // Sempre que o servidor responde com sucesso, ele é a fonte da verdade (inclui lista vazia).
      // Antes: messages.length === 0 caía no localStorage e reapareciam mensagens “apagadas”.
      if (data.success && Array.isArray(data.messages)) {
        const loadedMessages: Message[] =
          data.messages.length > 0
            ? data.messages.map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp),
              }))
            : createWelcomeAssistantMessages();

        console.log('[ConsultorIA] Total de mensagens (servidor):', loadedMessages.length);

        setMessages(loadedMessages);
        saveToLocalStorage(conversationId, loadedMessages);
        return;
      }

      if (response.status === 404) {
        removeConversationFromLocalStorage(conversationId);
        setMessages(createWelcomeAssistantMessages());
        return;
      }

      console.log('[ConsultorIA] Resposta inesperada, tentando localStorage...');
      const localMessages = loadFromLocalStorage(conversationId);
      if (localMessages && localMessages.length > 0) {
        setMessages(localMessages);
      } else {
        setMessages(createWelcomeAssistantMessages());
      }
    } catch (error) {
      console.error('[ConsultorIA] Erro ao carregar mensagens:', error);
      const localMessages = loadFromLocalStorage(conversationId);
      if (localMessages && localMessages.length > 0) {
        setMessages(localMessages);
      } else {
        setMessages(createWelcomeAssistantMessages());
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Criar nova conversa no banco de dados
  const createNewConversation = async () => {
    if (!userId) {
      console.log('[ConsultorIA] createNewConversation: userId não disponível');
      return null;
    }

    console.log('[ConsultorIA] Criando nova conversa para userId:', userId);

    try {
      const response = await fetch('/api/consultor/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: 'Nova Conversa',
        }),
      });

      const data = await response.json();
      console.log('[ConsultorIA] Resposta criação conversa:', data);

      if (data.success && data.conversation) {
        const welcomeMessages = createWelcomeAssistantMessages();

        const newConversation: Conversation = {
          id: data.conversation.id,
          title: data.conversation.title,
          createdAt: new Date(data.conversation.createdAt),
          messages: welcomeMessages,
        };

        console.log('[ConsultorIA] Nova conversa criada:', newConversation.id);
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversationId(newConversation.id);
        setMessages(newConversation.messages);
        setGptContextId(null);
        
        // Salvar no localStorage também
        saveConversationToLocalStorage(newConversation, welcomeMessages);
        
        return newConversation;
      } else {
        console.error('[ConsultorIA] Falha ao criar conversa no banco:', data);
        // Criar conversa local como fallback
        const localId = `local_${Date.now()}`;
        const welcomeMessages = createWelcomeAssistantMessages();

        const localConversation: Conversation = {
          id: localId,
          title: 'Nova Conversa',
          createdAt: new Date(),
          messages: welcomeMessages,
        };

        console.log('[ConsultorIA] Conversa local criada:', localId);
        setConversations(prev => [localConversation, ...prev]);
        setCurrentConversationId(localConversation.id);
        setMessages(localConversation.messages);
        setGptContextId(null);
        
        // Salvar no localStorage
        saveConversationToLocalStorage(localConversation, welcomeMessages);
        
        return localConversation;
      }
    } catch (error) {
      console.error('[ConsultorIA] Erro ao criar conversa:', error);
      
      // Criar conversa local como fallback
      const localId = `local_${Date.now()}`;
      const welcomeMessages = createWelcomeAssistantMessages();

      const localConversation: Conversation = {
        id: localId,
        title: 'Nova Conversa',
        createdAt: new Date(),
        messages: welcomeMessages,
      };

      setConversations(prev => [localConversation, ...prev]);
      setCurrentConversationId(localConversation.id);
      setMessages(localConversation.messages);
      setGptContextId(null);
      
      // Salvar no localStorage
      saveConversationToLocalStorage(localConversation, welcomeMessages);
      
      return localConversation;
    }
    return null;
  };

  // Adicionar mensagem do usuário e reiniciar timer
  const addUserMessage = () => {
    if (!inputValue.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };
    
    // Adicionar à lista de mensagens pendentes
    setPendingMessages(prev => [...prev, userMessage]);
    
    // Adicionar às mensagens exibidas
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // Resetar textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Enviar imediatamente
    setTimeout(() => sendPendingMessages(), 0);
  };

  // Resposta rápida: clicar numa opção numerada (1, 2, 9, 0…) envia direto
  const sendQuickReply = (value: string) => {
    if (isSendingRef.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: value,
      timestamp: new Date(),
    };

    setPendingMessages(prev => [...prev, userMessage]);
    setMessages(prev => [...prev, userMessage]);

    // Enviar imediatamente
    setTimeout(() => sendPendingMessages(), 0);
  };

  // Countdown do timer
  useEffect(() => {
    if (timeUntilSend > 0 && pendingMessages.length > 0) {
      const interval = setInterval(() => {
        setTimeUntilSend(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timeUntilSend, pendingMessages.length]);
  
  // Enviar mensagens pendentes para a IA
  const sendPendingMessages = async () => {
    // Usar refs para obter valores atualizados (evita closure stale)
    const currentPendingMessages = pendingMessagesRef.current;
    const currentMessages = [...messagesRef.current];
    const convId = currentConversationIdRef.current;

    console.log('[ConsultorIA] sendPendingMessages chamado, pendentes:', currentPendingMessages.length, 'convId:', convId);

    if (currentPendingMessages.length === 0) {
      console.log('[ConsultorIA] Nenhuma mensagem pendente');
      return;
    }

    if (isSendingRef.current) {
      console.log('[ConsultorIA] Já está enviando');
      return;
    }

    // Limpar timer
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
    }
    setTimeUntilSend(0);

    // Combinar todas as mensagens pendentes em uma única mensagem
    const combinedMessage = currentPendingMessages.map(m => m.content).join('\n\n');
    console.log('[ConsultorIA] Enviando mensagem combinada:', combinedMessage.substring(0, 100));

    setPendingMessages([]);
    setIsSending(true);

    // Salvar no localStorage imediatamente (backup)
    if (convId) {
      saveToLocalStorage(convId, currentMessages);
    }

    try {
      const response = await fetch('/api/consultor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: combinedMessage,
          contextId: gptContextId,
          conversationId: currentConversationIdRef.current,
          token: getAuthToken(),
          userName: planData?.fullName || 'Usuário',
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Salvar contextId para manter o histórico da conversa no n8n
        if (data.contextId) {
          setGptContextId(data.contextId);
        }

        // Se o route criou uma conversa nova no banco (ex: convId era local_XXXX),
        // sincronizar o ID real para que as próximas mensagens usem a mesma conversa
        const savedByRoute = Boolean(data.savedConversationId);
        if (savedByRoute && data.savedConversationId !== currentConversationIdRef.current) {
          const newDbId = data.savedConversationId as string;
          const oldId = currentConversationIdRef.current; // capturar ANTES de atualizar o state
          setCurrentConversationId(newDbId);
          setConversations(prev =>
            prev.map(c => c.id === oldId ? { ...c, id: newDbId } : c)
          );
        }

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };

        const finalMessages = [...currentMessages, aiMessage];

        // O route sempre salva (chat/route.ts é a fonte da verdade).
        // Aqui apenas exibimos as mensagens no estado local.
        setMessages(finalMessages);

        if (convId) {
          saveToLocalStorage(convId, finalMessages);

          const currentConv = conversations.find(c => c.id === convId);
          if (currentConv && currentConv.title === 'Nova Conversa') {
            const firstUserMsg = currentMessages.find(m => m.role === 'user');
            if (firstUserMsg) {
              const newTitle =
                firstUserMsg.content.substring(0, 50) +
                (firstUserMsg.content.length > 50 ? '...' : '');
              const updatedConv = { ...currentConv, title: newTitle };
              setConversations(prev =>
                prev.map(c => (c.id === convId ? updatedConv : c))
              );
              saveConversationToLocalStorage(updatedConv, finalMessages);
            }
          }
        }
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message || 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
          timestamp: new Date(),
        };
        const finalMessages = [...currentMessages, errorMessage];
        setMessages(finalMessages);
        if (convId) saveToLocalStorage(convId, finalMessages);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
        timestamp: new Date(),
      };
      const finalMessages = [...currentMessages, errorMessage];
      setMessages(finalMessages);
      if (convId) saveToLocalStorage(convId, finalMessages);
    } finally {
      setIsSending(false);
    }
  };

  const handleNewChat = async () => {
    setSidebarOpen(false); // fecha o sidebar no celular
    const newConv = await createNewConversation();
    if (!newConv) {
      // Fallback local se falhar ao criar no banco
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: 'Nova Conversa',
        createdAt: new Date(),
        messages: createWelcomeAssistantMessages(),
      };
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(newConversation.id);
      setMessages(newConversation.messages);
      setGptContextId(null);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId) || 
                        archivedConversations.find(c => c.id === conversationId);
    if (conversation) {
      setCurrentConversationId(conversationId);
      setContextMenuId(null);
      setSidebarOpen(false); // fecha o sidebar no celular ao escolher conversa
      await loadMessages(conversationId);
    }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation || !userId) return;

    try {
      // Atualizar no banco de dados
      await fetch('/api/consultor/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          userId,
          isArchived: true,
        }),
      });

      // Atualizar estado local
      const archivedConv = { ...conversation, isArchived: true };
      setArchivedConversations(prev => [...prev, archivedConv]);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      if (currentConversationId === conversationId) {
        const remaining = conversations.filter(c => c.id !== conversationId);
        if (remaining.length > 0) {
          setCurrentConversationId(remaining[0].id);
          await loadMessages(remaining[0].id);
        } else {
          await handleNewChat();
        }
      }
    } catch (error) {
      console.error('Erro ao arquivar conversa:', error);
    }
    setContextMenuId(null);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!userId) return;

    try {
      // Conversas locais (ex: "local_...") não existem no banco — apagar só localmente.
      if (!isUuid(conversationId)) {
        removeConversationFromLocalStorage(conversationId);

        let nextList: Conversation[] = [];
        setConversations(prev => {
          nextList = prev.filter(c => c.id !== conversationId);
          return nextList;
        });

        if (currentConversationId === conversationId) {
          if (nextList.length > 0) {
            setCurrentConversationId(nextList[0].id);
            await loadMessages(nextList[0].id);
          } else {
            await handleNewChat();
          }
        }

        setContextMenuId(null);
        return;
      }

      const res = await fetch(
        `/api/consultor/conversations?conversationId=${conversationId}&userId=${userId}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        console.error('[ConsultorIA] Falha ao deletar conversa:', data?.message || res.status);
        setContextMenuId(null);
        return;
      }

      removeConversationFromLocalStorage(conversationId);

      let nextList: Conversation[] = [];
      setConversations(prev => {
        nextList = prev.filter(c => c.id !== conversationId);
        return nextList;
      });

      if (currentConversationId === conversationId) {
        if (nextList.length > 0) {
          setCurrentConversationId(nextList[0].id);
          await loadMessages(nextList[0].id);
        } else {
          await handleNewChat();
        }
      }
    } catch (error) {
      console.error('Erro ao deletar conversa:', error);
    }
    setContextMenuId(null);
  };

  const handleRestoreConversation = async (conversationId: string) => {
    const conversation = archivedConversations.find(c => c.id === conversationId);
    if (!conversation || !userId) return;

    try {
      // Atualizar no banco de dados
      await fetch('/api/consultor/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          userId,
          isArchived: false,
        }),
      });

      // Atualizar estado local
      const restoredConv = { ...conversation, isArchived: false };
      setConversations(prev => [restoredConv, ...prev]);
      setArchivedConversations(prev => prev.filter(c => c.id !== conversationId));
    } catch (error) {
      console.error('Erro ao restaurar conversa:', error);
    }
    setContextMenuId(null);
  };

  const handleDeleteArchivedConversation = async (conversationId: string) => {
    if (!userId) return;

    try {
      if (!isUuid(conversationId)) {
        removeConversationFromLocalStorage(conversationId);
        setArchivedConversations(prev => prev.filter(c => c.id !== conversationId));
        setContextMenuId(null);
        return;
      }

      const res = await fetch(
        `/api/consultor/conversations?conversationId=${conversationId}&userId=${userId}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        console.error('[ConsultorIA] Falha ao deletar conversa arquivada:', data?.message || res.status);
        setContextMenuId(null);
        return;
      }
      removeConversationFromLocalStorage(conversationId);
      setArchivedConversations(prev => prev.filter(c => c.id !== conversationId));
    } catch (error) {
      console.error('Erro ao deletar conversa arquivada:', error);
    }
    setContextMenuId(null);
  };

  const handleStartRename = (conversation: Conversation) => {
    setContextMenuId(null);
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const handleRenameConversation = async (conversationId: string, newTitle: string) => {
    const t = newTitle.trim();
    if (!t || !userId) {
      setEditingConversationId(null);
      return;
    }
    setEditingConversationId(null);
    try {
      const res = await fetch('/api/consultor/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userId, title: t }),
      });
      const data = await res.json();
      if (data.success) {
        const upd = (c: Conversation) => (c.id === conversationId ? { ...c, title: t } : c);
        setConversations(prev => prev.map(upd));
        setArchivedConversations(prev => prev.map(upd));
      }
    } catch (error) {
      console.error('Erro ao renomear conversa:', error);
    }
  };

  // Extrair userId do token JWT
  const extractUserIdFromToken = (token: string): string | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload.userId || payload.sub || payload.id || null;
    } catch {
      return null;
    }
  };

  const fetchPlanData = async () => {
    try {
      const token = getAuthToken();
      const storedUserId = getUserId(); // Usar userId do localStorage
      
      console.log('[ConsultorIA] Buscando dados do plano...');
      console.log('[ConsultorIA] userId do localStorage:', storedUserId);

      // Construir URL com userId do localStorage como fallback (não seta state aqui — evita trigger duplo em loadConversations)
      let url = '/api/consultor/user-plan';
      if (storedUserId) {
        url += `?userId=${storedUserId}`;
      }

      const response = await fetch(url, {
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });
      
      if (!response.ok) {
        console.error('[ConsultorIA] Erro ao buscar dados do plano:', response.status);
        return;
      }
      const result = await response.json();
      console.log('[ConsultorIA] Resposta user-plan:', result);
      
      if (result.success && result.data) {
        console.log('[ConsultorIA] Definindo userId via user-plan:', result.data.userId);
        // Só define userId se ainda não foi definido pelo checkSession (evita trigger duplo)
        if (!userIdRef.current) {
          setUserId(result.data.userId);
        }

        setPlanData({
          planName: result.data.planName,
          creditsAvailable: result.data.creditsAvailable,
          creditsUsed: result.data.creditsUsed,
          monthlyLimit: result.data.monthlyLimit,
          renewalDate: new Date(result.data.renewalDate),
          fullName: result.data.fullName,
          email: result.data.email,
          userId: result.data.userId,
        });
      }
    } catch (error) {
      console.error('[ConsultorIA] Erro ao carregar dados do plano:', error);
      const token = getAuthToken();
      if (token) {
        const fallbackUserId = extractUserIdFromToken(token);
        if (fallbackUserId) setUserId(fallbackUserId);
      }
    }
  };

  const handleCopyMessage = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }).catch(() => {
      // fallback para browsers sem clipboard API
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    });
  };

  const handleDislikeMessage = (messageId: string) => {
    setDislikedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  // ── Seleção de mensagens para exportação ──────────────────────────
  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedMessageIds(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId); else next.add(messageId);
      return next;
    });
  };

  const handleExportSelected = () => {
    const selected = messages.filter(m => selectedMessageIds.has(m.id));
    if (selected.length === 0) {
      alert('Selecione ao menos uma mensagem para exportar.');
      return;
    }
    handleExportPDF(selected);
    exitSelectionMode();
  };

  const handleExportPDF = (msgsToExport?: Message[]) => {
    const currentConv = conversations.find(c => c.id === currentConversationId);
    const title = currentConv?.title || 'Conversa';
    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const userName_ = planData?.fullName || userName || 'Usuário';

    // Se recebeu uma lista (seleção), usa ela; senão, todas menos a de boas-vindas
    const source = msgsToExport && msgsToExport.length > 0
      ? msgsToExport
      : messages.filter(m => m.id !== '1');

    const rows = source
      .filter(m => m.id !== '1') // nunca exportar a mensagem de boas-vindas
      .map(m => {
        const who = m.role === 'user' ? userName_ : 'Consultor.IA';
        const time = m.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const content = m.content
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br>');
        return `
          <div class="msg msg--${m.role}">
            <div class="msg-header"><strong>${who}</strong><span class="time">${time}</span></div>
            <div class="msg-body">${content}</div>
          </div>`;
      }).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8">
      <title>${title} — Consultor.IA Equalizagro</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; margin: 0; padding: 24px 32px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a5f3a; padding-bottom: 12px; margin-bottom: 24px; }
        .header h1 { margin: 0; font-size: 18px; color: #1a5f3a; }
        .header .meta { font-size: 11px; color: #666; text-align: right; }
        .msg { margin-bottom: 18px; padding: 12px 14px; border-radius: 8px; page-break-inside: avoid; }
        .msg--user { background: #f0f7f3; border-left: 3px solid #1a5f3a; }
        .msg--assistant { background: #fafafa; border-left: 3px solid #c9a420; }
        .msg-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; color: #555; }
        .msg-body { line-height: 1.6; }
        .time { font-style: italic; }
        .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 10px; color: #999; text-align: center; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div class="header">
        <h1>${title}</h1>
        <div class="meta">Consultor.IA - goa2pply <br>${date}<br>${userName_}</div>
      </div>
      ${rows || '<p style="color:#999">Nenhuma mensagem nesta conversa.</p>'}
      <div class="footer">Gerado pelo Consultor.IA — go2apply</div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para exportar o PDF.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  // Mostrar mensagem de sessão expirada
  if (sessionError) {
    return (
      <div className="consultor-loading">
        <div className="consultor-session-error">
          <div className="consultor-session-error__icon">⚠️</div>
          <h2>Sessão Expirada</h2>
          <p>{sessionError}</p>
          <p className="consultor-session-error__redirect">Redirecionando para login...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="consultor-loading">
        <div className="consultor-loading__spinner"></div>
        <p>Carregando Consultor.IA...</p>
      </div>
    );
  }

  return (
    <div className="consultor">
      {/* Sidebar - Layout vertical estilo Gemini (de cima para baixo) */}
      <div className={`consultor__sidebar consultor__sidebar--vertical ${sidebarOpen ? 'consultor__sidebar--open' : ''}`}>
        {/* Topo: Logo + Fechar */}
        <div className="consultor__sidebar-header">
          <a href="/dashboard" className="consultor__logo">
            <img
              src="/images/LOGO-CONSULTOR-IA-BRANCO.png"
              alt="Consultor.IA"
              className="header__logo-image"
            />
          </a>
          <button
            onClick={() => setSidebarOpen(false)}
            className="consultor__sidebar-close"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conta (mobile/tablet) */}
        <div className="consultor__sidebar-account">
          <div className="consultor__sidebar-account-avatar">
            <User size={20} />
          </div>
          <div className="consultor__sidebar-account-info">
            <span className="consultor__sidebar-account-name">
              {planData?.fullName || userName || 'Minha conta'}
            </span>
            <span className="consultor__sidebar-account-plan">
              {planData?.planName ? `Plano ${planData.planName}` : 'Consultor.IA'}
            </span>
          </div>
        </div>

        {/* Nova conversa */}
        <button onClick={handleNewChat} className="consultor__new-chat">
          <Plus size={20} />
          <span>Nova conversa</span>
        </button>

        {/* Pesquisa de conversas */}
        <div className="consultor__sidebar-search-wrap">
          <Search size={18} className="consultor__sidebar-search-icon" />
          <input
            type="text"
            className="consultor__sidebar-search"
            placeholder="Pesquise conversas"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            aria-label="Pesquisar conversas"
          />
        </div>

        {/* Histórico: Conversas */}
        <div className="consultor__conversations">
          <div className="consultor__conversations-header">
            <h3 className="consultor__conversations-title">
              {showArchived ? 'Conversas arquivadas' : 'Conversas'}
            </h3>
            {archivedConversations.length > 0 && (
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="consultor__conversations-toggle"
                title={showArchived ? 'Ver conversas recentes' : 'Ver arquivadas'}
              >
                <Archive size={16} />
              </button>
            )}
          </div>
          <div className="consultor__conversations-list">
            {isLoadingConversations ? (
              <div className="consultor__conversations-loading">
                <div className="consultor__typing-indicator" style={{ justifyContent: 'center' }}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            ) : filteredConversations.map(conversation => (
              <div
                key={conversation.id}
                className="consultor__conversation-item-container"
              >
                <button
                  onClick={() => !editingConversationId && handleSelectConversation(conversation.id)}
                  className={`consultor__conversation-item ${
                    conversation.id === currentConversationId ? 'consultor__conversation-item--active' : ''
                  }`}
                >
                  {editingConversationId === conversation.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      className="consultor__conversation-edit-input"
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={() => handleRenameConversation(conversation.id, editingTitle)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameConversation(conversation.id, editingTitle);
                        if (e.key === 'Escape') setEditingConversationId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      aria-label="Novo nome da conversa"
                    />
                  ) : (
                    <span className="consultor__conversation-title">{conversation.title}</span>
                  )}
                </button>
                <div className="consultor__conversation-actions">
                  <button
                    onClick={(e) => { e.stopPropagation(); setContextMenuId(contextMenuId === conversation.id ? null : conversation.id); }}
                    className="consultor__conversation-menu-button"
                    aria-label="Opções: Renomear, Arquivar, Deletar"
                  >
                    ⋮
                  </button>
                  {contextMenuId === conversation.id && (
                    <div className="consultor__context-menu">
                      <button
                        onClick={() => handleStartRename(conversation)}
                        className="consultor__context-menu-item"
                      >
                        <Pencil size={14} />
                        Renomear
                      </button>
                      {!showArchived ? (
                        <>
                          <button
                            onClick={() => handleArchiveConversation(conversation.id)}
                            className="consultor__context-menu-item"
                          >
                            <Archive size={14} />
                            Arquivar
                          </button>
                          <button
                            onClick={() => handleDeleteConversation(conversation.id)}
                            className="consultor__context-menu-item consultor__context-menu-item--danger"
                          >
                            <Trash2 size={14} />
                            Deletar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRestoreConversation(conversation.id)}
                            className="consultor__context-menu-item"
                          >
                            <Archive size={14} />
                            Restaurar
                          </button>
                          <button
                            onClick={() => handleDeleteArchivedConversation(conversation.id)}
                            className="consultor__context-menu-item consultor__context-menu-item--danger"
                          >
                            <Trash2 size={14} />
                            Deletar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!isLoadingConversations && filteredConversations.length === 0 && (
              <p className="consultor__conversations-empty">
                {sidebarSearch.trim()
                  ? 'Nenhuma conversa encontrada'
                  : showArchived
                    ? 'Nenhuma conversa arquivada'
                    : 'Nenhuma conversa recente'}
              </p>
            )}
          </div>
        </div>

        {/* Rodapé: Logo Equalizagro + Voltar ao Dashboard */}
        <div className="consultor__sidebar-footer">
          <div className="consultor__sidebar-brand">
            <img src="/images/EQUALIZAGRO ok.png" alt="Equalizagro" className="consultor__sidebar-brand-logo" />
          </div>
          <a href="/dashboard" className="consultor__sidebar-button consultor__sidebar-button--danger">
            <LogOut size={18} />
            <span>Voltar ao Dashboard</span>
          </a>
        </div>
      </div>

      {/* Overlay do Sidebar (mobile) */}
      {sidebarOpen && (
        <div
          className="consultor__sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Chat Area */}
      <div className="consultor__main">
        <div className="consultor__header">
          <button
            onClick={() => setSidebarOpen(true)}
            className="consultor__menu-button"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          {selectionMode ? (
            <>
              <span className="consultor__select-count">
                {selectedMessageIds.size} selecionada{selectedMessageIds.size === 1 ? '' : 's'}
              </span>
              <div className="consultor__select-actions">
                <button
                  onClick={handleExportSelected}
                  className="consultor__select-export"
                  disabled={selectedMessageIds.size === 0}
                  title="Baixar mensagens selecionadas"
                >
                  <FileDown size={16} /> Baixar
                </button>
                <button
                  onClick={exitSelectionMode}
                  className="consultor__select-cancel"
                  title="Cancelar seleção"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="consultor__title">Consultor.IA</h1>
              <button
                onClick={enterSelectionMode}
                className="consultor__export-button"
                aria-label="Selecionar mensagens para exportar"
                title="Selecionar mensagens para exportar"
                disabled={messages.filter(m => m.id !== '1').length === 0}
              >
                <FileDown size={18} />
              </button>
            </>
          )}
        </div>

        <div className="consultor__messages-container">
          <div className="consultor__messages">
            {isLoadingMessages ? (
              <div className="consultor__empty-state">
                <div className="consultor__typing-indicator" style={{ justifyContent: 'center' }}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p className="consultor__empty-description">Carregando conversa...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="consultor__empty-state">
                <div className="consultor__empty-icon" style={{ color: '#1a5f3a', display: 'flex', justifyContent: 'center' }}>
                  <Leaf size={48} strokeWidth={1.5} />
                </div>
                <h2 className="consultor__empty-title">Bem-vindo ao Consultor.IA</h2>
                <p className="consultor__empty-description">
                  Faça perguntas sobre aplicação de defensivos, manejo de plantas daninhas,
                  consultoria agrícola e muito mais!
                </p>
              </div>
            ) : (
              messages.map(message => {
                const selectable = selectionMode && message.id !== '1';
                const isSelected = selectedMessageIds.has(message.id);
                return (
                <div
                  key={message.id}
                  className={`consultor__message consultor__message--${message.role}${selectable ? ' consultor__message--selectable' : ''}${isSelected ? ' consultor__message--selected' : ''}`}
                  onClick={selectable ? () => toggleMessageSelection(message.id) : undefined}
                >
                  {selectable && (
                    <div className={`consultor__message-checkbox${isSelected ? ' consultor__message-checkbox--checked' : ''}`}>
                      {isSelected && <Check size={14} />}
                    </div>
                  )}
                  <div className="consultor__message-avatar">
                    {message.role === 'user' ? (
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{(userName || planData?.fullName || '?')[0].toUpperCase()}</span>
                    ) : (
                      <img src="/images/Equalizagro-gota-logo.png" alt="Consultor IA" className="consultor__message-avatar-image" />
                    )}
                  </div>
                  <div className="consultor__message-content">
                    <FormattedMessage
                      content={message.content}
                      role={message.role}
                      onOptionClick={selectionMode ? undefined : sendQuickReply}
                    />
                    <span className="consultor__message-time">
                      {message.timestamp.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {!selectionMode && message.role === 'assistant' && message.id !== '1' && (
                      <div className="consultor__message-actions">
                        <button
                          className="consultor__msg-action-btn"
                          onClick={() => handleCopyMessage(message.id, message.content)}
                          title="Copiar resposta"
                          aria-label="Copiar resposta"
                        >
                          {copiedMessageId === message.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                          className={`consultor__msg-action-btn${dislikedMessageIds.has(message.id) ? ' consultor__msg-action-btn--disliked' : ''}`}
                          onClick={() => handleDislikeMessage(message.id)}
                          title="Resposta ruim"
                          aria-label="Marcar resposta como ruim"
                        >
                          <ThumbsDown size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                );
              })
            )}
            {isSending && (
              <div className="consultor__message consultor__message--assistant">
                <div className="consultor__message-avatar">
                  <img src="/images/Equalizagro-gota-logo.png" alt="Consultor IA" className="consultor__message-avatar-image" />
                </div>
                <div className="consultor__message-content">
                  <div className="consultor__typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="consultor__input-area">

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              addUserMessage();
            }} 
            className="consultor__input-form"
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (isMobileDevice()) return; // mobile: Enter = nova linha (padrão do teclado)
                  e.preventDefault();
                  addUserMessage();
                }
              }}
              placeholder="Digite sua mensagem..."
              className="consultor__input consultor__input--textarea"
              disabled={isSending}
              rows={1}
            />
            <button
              type="submit"
              className="consultor__send-button"
              disabled={!inputValue.trim() || isSending}
              aria-label="Adicionar mensagem"
            >
              <Send size={20} />
            </button>
          </form>
          <p className="consultor__disclaimer">
            Consultor.IA pode cometer erros. Sempre verifique informações críticas antes de implementar.
            <br />
            
          </p>
        </div>
      </div>

    </div>
  );
}
