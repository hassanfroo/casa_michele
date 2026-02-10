
import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserCircle,
  Wine,
  ClipboardList,
  Beer,
  Search,
  RefreshCw,
  Check,
  Trash2,
  AlertCircle,
  X,
  ChevronRight,
  Clock,
  Filter,
  Image as ImageIcon,
  BookOpen,
  LayoutGrid,
  List as ListIcon,
  Bell,
  Eye,
  EyeOff,
  Lock,
  Tag,
  QrCode,
  MessageCircle,
  Phone
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { Cocktail, Order, OrderStatus, IngredientAvailability, EventSession } from './types';
import { MockDB } from './services/db';
import { fetchCocktailsFromSheet } from './services/sheet';
import { Button, BottomSheet, Toast, Badge } from './components/UI';

const INGREDIENT_CATEGORIES = [
  'Spirit',
  'Liqueur',
  'Juice',
  'Syrup',
  'Bitter',
  'Other'
];

const SPIRITS_LIST = [
  'Bourbon',
  'Calvados',
  'Cognac',
  'Gin',
  'Pisco',
  'Rum',
  'Tequila',
  'Vodka',
  'Other'
];

const BARTENDER_PASSWORD = 'shake';

const categorizeIngredient = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('bitter')) return 'Bitter';
  if (n.includes('juice')) return 'Juice';
  if (n.includes('syrup')) return 'Syrup';
  if (n.includes('ginger beer')) return 'Other';
  if (n.includes('bourbon') || n.includes('calvados') || n.includes('cognac') ||
    n.includes('gin') || n.includes('pisco') || n.includes('rum') ||
    n.includes('tequila') || n.includes('vodka')) return 'Spirit';
  if (n.includes('amaretto') || n.includes('aperol') || n.includes('apple schnapps') ||
    n.includes('blue curacao') || n.includes('campari') || n.includes('cointreau') ||
    n.includes('cacao') || n.includes('mente') || n.includes('violette') ||
    n.includes('kahlua') || n.includes('lillet') || n.includes('maraschino') ||
    n.includes('vermouth')) return 'Liqueur';
  return 'Other';
};

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'bartender' | 'guest'>('landing');
  const [session, setSession] = useState<EventSession | null>(null);
  const [cocktails, setCocktails] = useState<Cocktail[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [availability, setAvailability] = useState<IngredientAvailability>({});

  const [activeTab, setActiveTab] = useState<'ingredients' | 'orders' | 'instructions'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCocktail, setSelectedCocktail] = useState<Cocktail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [lastOrderTime, setLastOrderTime] = useState(0);
  const [guestViewMode, setGuestViewMode] = useState<'grid' | 'list'>('grid');
  const [bartenderViewMode, setBartenderViewMode] = useState<'grid' | 'list'>('grid');

  const [filterUnavailableOnly, setFilterUnavailableOnly] = useState(false);
  const [guestShowUnavailable, setGuestShowUnavailable] = useState(false);
  const [activeCategories, setActiveCategories] = useState<string[]>(INGREDIENT_CATEGORIES);
  const [activeRecipeSpirits, setActiveRecipeSpirits] = useState<string[]>(SPIRITS_LIST);
  const [activeGuestSpirits, setActiveGuestSpirits] = useState<string[]>(SPIRITS_LIST);
  const [activeTasteProfiles, setActiveTasteProfiles] = useState<string[]>([]);

  // Notification State
  const [notifiedOrders, setNotifiedOrders] = useState<Set<string>>(new Set());
  const [pickupNotification, setPickupNotification] = useState<Order | null>(null);
  const [hasInitializedOrders, setHasInitializedOrders] = useState(false);

  // QR Code & Auto-Join State
  const [pendingSessionCode, setPendingSessionCode] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [guestPhoneInput, setGuestPhoneInput] = useState('');

  useEffect(() => {
    const saved = MockDB.getCocktails();
    if (saved && saved.length > 0) {
      setCocktails(saved);
    } else {
      refreshData();
    }
  }, []);

  useEffect(() => {
    if (session?.eventCode) {
      const poll = setInterval(() => {
        setOrders(MockDB.getOrders(session.eventCode));
        setAvailability(MockDB.getAvailability(session.eventCode));
      }, 3000);
      return () => clearInterval(poll);
      return () => clearInterval(poll);
    }
  }, [session?.eventCode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setPendingSessionCode(code.toUpperCase());
      setView('guest');
    }
  }, []);

  // Guest Notification Logic
  useEffect(() => {
    if (view === 'guest' && session && orders.length > 0) {
      // 1. Initialize logic: Don't notify for historical completed orders on first load/refresh
      if (!hasInitializedOrders) {
        const historyCompleted = orders.filter(o => o.status === 'completed' && o.guestName === session.guestName);
        setNotifiedOrders(new Set(historyCompleted.map(o => o.id)));
        setHasInitializedOrders(true);
        return;
      }

      // 2. Check for NEW completed orders
      const myCompletedOrders = orders.filter(o => o.status === 'completed' && o.guestName === session.guestName);
      const newReady = myCompletedOrders.find(o => !notifiedOrders.has(o.id));

      if (newReady) {
        setPickupNotification(newReady);
        setNotifiedOrders(prev => new Set(prev).add(newReady.id));
        // Simple vibration if supported
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }
  }, [orders, view, session, hasInitializedOrders, notifiedOrders]);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchCocktailsFromSheet();
      if (data.length > 0) {
        setCocktails(data);
        MockDB.saveCocktails(data);
        showToast('Menu Updated from Sheet');
      } else {
        showToast('No cocktails found in Sheet');
      }
    } catch (e) {
      showToast('Failed to load menu');
      console.error(e);
    }
    setIsRefreshing(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const handleJoin = (role: 'bartender' | 'guest', code: string, guestName?: string, guestPhone?: string) => {
    if (!code) return;
    setSession({ eventCode: code.toUpperCase(), isBartender: role === 'bartender', guestName, guestPhone });
    setView(role);
    setOrders(MockDB.getOrders(code.toUpperCase()));
    setAvailability(MockDB.getAvailability(code.toUpperCase()));
    // Reset notification state on new join
    setNotifiedOrders(new Set());
    setHasInitializedOrders(false);
  };

  const toggleAvailability = (ingredient: string) => {
    if (!session) return;
    const newAvail = { ...availability, [ingredient]: !availability[ingredient] };
    setAvailability(newAvail);
    MockDB.setAvailability(session.eventCode, newAvail);
  };

  const updateOrder = (orderId: string, status: OrderStatus) => {
    MockDB.updateOrderStatus(orderId, status);
    setOrders(MockDB.getOrders(session?.eventCode || ''));
    if (status === 'completed') showToast('Guest Notified');
  };

  const openRecipeForOrder = (order: Order) => {
    const cocktail = cocktails.find(c => c.id === order.cocktailId) ||
      cocktails.find(c => c.name === order.cocktailName);
    if (cocktail) {
      setSelectedCocktail(cocktail);
    } else {
      showToast('Recipe not found');
    }
  };

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleRecipeSpirit = (spirit: string) => {
    setActiveRecipeSpirits(prev =>
      prev.includes(spirit) ? prev.filter(s => s !== spirit) : [...prev, spirit]
    );
  };

  const toggleGuestSpirit = (spirit: string) => {
    setActiveGuestSpirits(prev =>
      prev.includes(spirit) ? prev.filter(s => s !== spirit) : [...prev, spirit]
    );
  };

  const toggleTasteProfile = (profile: string) => {
    setActiveTasteProfiles(prev =>
      prev.includes(profile) ? prev.filter(p => p !== profile) : [...prev, profile]
    );
  };

  const placeOrder = () => {
    if (!session || !selectedCocktail) return;

    // Safety check for availability at moment of order
    if (selectedCocktail.ingredients.some(i => availability[i])) {
      showToast('Sorry, ingredients just ran out!');
      setIsConfirmingOrder(false);
      return;
    }

    const now = Date.now();
    if (now - lastOrderTime < 30000) {
      showToast('Safety lock: Wait 30s');
      return;
    }
    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      eventCode: session.eventCode,
      guestName: session.guestName || 'Guest',
      guestPhone: session.guestPhone,
      cocktailId: selectedCocktail.id,
      cocktailName: selectedCocktail.name,
      status: 'pending',
      timestamp: now,
    };
    MockDB.createOrder(newOrder);
    setLastOrderTime(now);
    setIsConfirmingOrder(false);
    setSelectedCocktail(null);
    showToast('Sent to bar!');
  };

  const allIngredients = useMemo(() => {
    const set = new Set(cocktails.flatMap(c => c.ingredients).filter(i => i.length > 1));
    return Array.from(set).sort();
  }, [cocktails]);

  const allTasteProfiles = useMemo(() => {
    const set = new Set(cocktails.flatMap(c => c.tasteProfiles || []));
    return Array.from(set).sort();
  }, [cocktails]);

  const filteredIngredients = useMemo(() => {
    return allIngredients
      .filter(ing => ing.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter(ing => {
        if (filterUnavailableOnly && !availability[ing]) return false;
        const cat = categorizeIngredient(ing);
        return activeCategories.includes(cat);
      });
  }, [allIngredients, searchQuery, filterUnavailableOnly, activeCategories, availability]);

  const filteredRecipes = useMemo(() => {
    return cocktails.filter(c => {
      // 1. Search
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Spirit Filter
      const cocktailSpirits = c.ingredients.filter(ing => categorizeIngredient(ing) === 'Spirit');
      let spiritMatch = false;
      if (cocktailSpirits.length === 0) {
        spiritMatch = activeRecipeSpirits.includes('Other');
      } else {
        spiritMatch = cocktailSpirits.some(ing => {
          const lowerIng = ing.toLowerCase();
          return activeRecipeSpirits.some(s => lowerIng.includes(s.toLowerCase()));
        });
      }
      if (!spiritMatch) return false;

      // 3. Taste Profile Filter
      if (activeTasteProfiles.length > 0) {
        const profiles = c.tasteProfiles || [];
        const tasteMatch = profiles.some(p => activeTasteProfiles.includes(p));
        if (!tasteMatch) return false;
      }

      return true;
    });
  }, [cocktails, searchQuery, activeRecipeSpirits, activeTasteProfiles]);

  const filteredGuestCocktails = useMemo(() => {
    return cocktails.filter(c => {
      // 1. Availability Check
      const isUnavailable = c.ingredients.some(i => availability[i]);
      if (!guestShowUnavailable && isUnavailable) return false;

      // 2. Search
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 3. Spirits
      const cocktailSpirits = c.ingredients.filter(ing => categorizeIngredient(ing) === 'Spirit');
      let spiritMatch = false;
      if (cocktailSpirits.length === 0) {
        spiritMatch = activeGuestSpirits.includes('Other');
      } else {
        spiritMatch = cocktailSpirits.some(ing => {
          const lowerIng = ing.toLowerCase();
          return activeGuestSpirits.some(s => lowerIng.includes(s.toLowerCase()));
        });
      }
      if (!spiritMatch) return false;

      // 4. Taste Profiles (Optional Filter)
      if (activeTasteProfiles.length > 0) {
        const profiles = c.tasteProfiles || [];
        const tasteMatch = profiles.some(p => activeTasteProfiles.includes(p));
        if (!tasteMatch) return false;
      }

      return true;
    });
  }, [cocktails, searchQuery, activeGuestSpirits, availability, guestShowUnavailable, activeTasteProfiles]);

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col p-8 items-center justify-center space-y-12">
        <div className="text-center space-y-6">
          <div className="w-28 h-28 bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 rounded-[36px] flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(251,191,36,0.2)]">
            <Wine size={56} strokeWidth={2.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tight text-white uppercase italic">Casa Michele</h1>
            <p className="text-zinc-500 text-xl font-medium">Your barkeeping companion.</p>
          </div>
        </div>
        <div className="w-full max-sm space-y-4">
          <Button onClick={() => setView('guest')} className="h-20 text-xl bg-white text-zinc-950 hover:bg-zinc-200">
            <Users className="mr-3" /> Guest
          </Button>
          <Button onClick={() => setView('bartender')} variant="ghost" className="h-16 text-zinc-400 font-bold border border-zinc-800">
            <UserCircle className="mr-2" /> Bartender Access
          </Button>
        </div>
      </div>
    );
  }

  if (view === 'guest' && session) {
    const lastOrder = [...orders].filter(o => o.guestName === session.guestName).sort((a, b) => b.timestamp - a.timestamp)[0];
    const isUnavailable = selectedCocktail?.ingredients.some(i => availability[i]);

    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center">
        <div className="w-full max-w-7xl flex flex-col min-h-screen">
          <header className="px-6 py-4 flex justify-between items-center border-b border-zinc-900">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <h1 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Live: {session.eventCode}</h1>
              </div>
            </div>
            <button onClick={() => setSession(null)} className="px-3 py-1.5 bg-zinc-900 rounded-xl text-zinc-400 font-bold text-xs">Exit</button>
          </header>

          {lastOrder && (
            <div className="px-4 pt-4">
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-1">Last Order</p>
                  <p className="text-white font-bold text-sm">{lastOrder.cocktailName}</p>
                </div>
                <Badge variant={lastOrder.status === 'completed' ? 'success' : 'neutral'}>{lastOrder.status}</Badge>
              </div>
            </div>
          )}

          <div className="sticky top-0 z-30 bg-zinc-950 pt-6 pb-2 space-y-3 shadow-sm shadow-zinc-900">
            <div className="px-4 space-y-1">
              <h2 className="text-2xl font-black text-white italic tracking-tight">What do you want to order?</h2>
              <p className="text-zinc-500 text-[11px] font-medium uppercase tracking-wider">Tap to filter & view</p>
            </div>

            <div className="px-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-11 pr-4 bg-zinc-900 rounded-xl border-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-amber-500/50 outline-none transition-all text-sm text-white"
                />
              </div>
              <button
                onClick={() => setGuestViewMode(guestViewMode === 'grid' ? 'list' : 'grid')}
                className="h-11 w-11 flex items-center justify-center bg-zinc-900 rounded-xl border border-zinc-800 text-zinc-400 active:scale-95 transition-all"
                title={guestViewMode === 'grid' ? "Switch to List View" : "Switch to Grid View"}
              >
                {guestViewMode === 'grid' ? <ListIcon size={18} /> : <LayoutGrid size={18} />}
              </button>
            </div>

            <div className="space-y-2 pb-2">
              {/* Row 1: Spirits & Settings */}
              <div className="flex overflow-x-auto gap-1.5 px-4 py-4 items-center">
                <button
                  onClick={() => setGuestShowUnavailable(!guestShowUnavailable)}
                  className={`shrink-0 h-[28px] px-3.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${guestShowUnavailable ? 'bg-red-500/10 text-red-500 border-red-500/50' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}
                >
                  {guestShowUnavailable ? <Eye size={12} /> : <EyeOff size={12} />}
                  {guestShowUnavailable ? 'Hide Out' : 'Show Out'}
                </button>
                <div className="w-px h-4 bg-zinc-800 shrink-0 mx-1"></div>
                {SPIRITS_LIST.map(spirit => (
                  <button
                    key={spirit}
                    onClick={() => toggleGuestSpirit(spirit)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeGuestSpirits.includes(spirit) ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800'}`}
                  >
                    {spirit}
                  </button>
                ))}
              </div>

              {/* Row 2: Taste Profiles (Only if available) */}
              {allTasteProfiles.length > 0 && (
                <div className="flex overflow-x-auto gap-1.5 px-4 py-4 items-center fade-in duration-500 -mt-2">
                  <div className="flex items-center justify-center w-6 shrink-0 text-zinc-600">
                    <Tag size={12} />
                  </div>
                  {allTasteProfiles.map(profile => (
                    <button
                      key={profile}
                      onClick={() => toggleTasteProfile(profile)}
                      className={`shrink-0 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${activeTasteProfiles.includes(profile) ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}
                    >
                      {profile}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto p-4 pb-32 ${guestViewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3' : 'flex flex-col gap-2'}`}>
            {filteredGuestCocktails.length === 0 ? (
              <div className="col-span-full py-20 text-center space-y-3">
                <Wine size={48} className="mx-auto text-zinc-800" />
                <p className="text-zinc-600 text-xs font-black uppercase tracking-widest">No matching cocktails</p>
                {!guestShowUnavailable && (
                  <button onClick={() => setGuestShowUnavailable(true)} className="text-amber-500 text-[10px] font-bold uppercase underline">Check Unavailable Items</button>
                )}
              </div>
            ) : (
              filteredGuestCocktails.map(c => {
                const unavailableCount = c.ingredients.filter(i => availability[i]).length;
                const isOut = unavailableCount > 0;

                if (guestViewMode === 'grid') {
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCocktail(c)}
                      className={`group relative bg-zinc-900 rounded-2xl overflow-hidden shadow-lg active:scale-[0.96] transition-all flex flex-col ${isOut ? 'opacity-50 grayscale' : ''}`}
                    >
                      <div className="aspect-square bg-zinc-800 relative overflow-hidden flex items-center justify-center">
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          className="w-full h-full object-cover object-[center_60%] transition-transform duration-500 group-active:scale-110"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                          }}
                        />
                        <div className="fallback-icon hidden text-zinc-700">
                          <ImageIcon size={24} />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent"></div>
                        {isOut && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="error">OUT</Badge>
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-center">
                        <h3 className="text-xs font-black text-white leading-tight line-clamp-2">{c.name}</h3>
                        <p className="text-zinc-500 text-[8px] font-black uppercase truncate tracking-tighter">
                          {c.ingredients.filter(i => categorizeIngredient(i) === 'Spirit').join(', ') || 'House Mix'}
                        </p>
                        {/* Taste Profiles - Below Spirit */}
                        {c.tasteProfiles && c.tasteProfiles.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {c.tasteProfiles.slice(0, 3).map(p => (
                              <span key={p} className="text-[8px] font-bold text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded-md tracking-wider">
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCocktail(c)}
                      className={`group flex items-center gap-4 bg-zinc-900 p-2.5 rounded-2xl border border-zinc-800 active:scale-[0.98] transition-all ${isOut ? 'opacity-50 grayscale' : ''}`}
                    >
                      <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-zinc-800 flex items-center justify-center relative">
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                          }}
                        />
                        <div className="fallback-icon hidden text-zinc-700">
                          <ImageIcon size={16} />
                        </div>
                        {isOut && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><X size={12} className="text-red-500" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white truncate">{c.name}</h3>
                          {isOut && <Badge variant="error">OUT</Badge>}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-zinc-500 text-[9px] font-black uppercase truncate tracking-widest">
                            {c.ingredients.filter(i => categorizeIngredient(i) === 'Spirit').join(', ') || 'House Mix'}
                          </p>
                          {c.tasteProfiles && c.tasteProfiles.length > 0 && (
                            <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">{c.tasteProfiles.join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-zinc-700 mr-1" />
                    </div>
                  );
                }
              })
            )}
          </div>

          <Toast isVisible={!!toastMessage} message={toastMessage} onHide={() => setToastMessage('')} />

          {/* Pickup Notification Overlay */}
          {pickupNotification && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[32px] w-full max-w-sm text-center space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none" />
                <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto text-zinc-950 shadow-[0_0_40px_rgba(34,197,94,0.4)] animate-bounce">
                  <Bell size={40} strokeWidth={3} fill="currentColor" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white uppercase italic tracking-tight">Order Ready!</h3>
                  <p className="text-zinc-400 font-medium text-lg leading-relaxed">
                    Your <span className="text-amber-500 font-bold">{pickupNotification.cocktailName}</span> is ready for pickup at the bar.
                  </p>
                </div>
                <Button onClick={() => setPickupNotification(null)} className="bg-white text-zinc-950 h-16 text-xl">
                  I'm on my way
                </Button>
              </div>
            </div>
          )}

          <BottomSheet
            isOpen={!!selectedCocktail}
            onClose={() => setSelectedCocktail(null)}
            title={selectedCocktail?.name || ''}
            footer={
              <Button
                onClick={() => setIsConfirmingOrder(true)}
                className={isUnavailable ? "bg-zinc-800 text-zinc-500" : "bg-amber-500 text-zinc-950 h-14"}
                disabled={isUnavailable}
              >
                {isUnavailable ? 'Unavailable' : 'Order Cocktail'}
              </Button>
            }
          >
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-zinc-800 flex items-center justify-center relative">
                <img
                  src={selectedCocktail?.imageUrl}
                  className="w-full h-full object-cover object-[center_60%]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                  }}
                />
                <div className="fallback-icon hidden text-zinc-700">
                  <ImageIcon size={48} />
                </div>
                {/* Taste Profiles in Bottom Sheet - Keep strict ones */}
                {selectedCocktail?.tasteProfiles && selectedCocktail.tasteProfiles.length > 0 && (
                  <div className="absolute top-4 left-4 flex gap-1.5 flex-wrap">
                    {selectedCocktail.tasteProfiles.map(p => (
                      <span key={p} className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-lg border border-white/10">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Notes</h4>
                <p className="text-zinc-300 text-sm leading-relaxed">{selectedCocktail?.description}</p>
              </div>
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ingredients</h4>
                <ul className="space-y-1.5">
                  {selectedCocktail?.ingredients.filter(i => i.length > 1).map(ing => (
                    <li key={ing} className={`flex items-center gap-2.5 p-3 rounded-xl ${availability[ing] ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-zinc-800/50 text-zinc-200'}`}>
                      {availability[ing] ? <X size={14} /> : <Check size={14} className="text-green-500" />}
                      <span className="font-bold text-sm">{ing}</span>
                      {availability[ing] && <span className="ml-auto text-[8px] font-black uppercase">Out</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </BottomSheet>

          <BottomSheet
            isOpen={isConfirmingOrder}
            onClose={() => setIsConfirmingOrder(false)}
            title="Place Order"
            footer={
              <div className="flex flex-col gap-2 max-w-sm mx-auto w-full">
                <Button onClick={placeOrder} className="bg-amber-500 text-zinc-950">Confirm</Button>
                <Button onClick={() => setIsConfirmingOrder(false)} variant="ghost" className="text-zinc-500 h-10 text-sm">Cancel</Button>
              </div>
            }
          >
            <div className="py-4 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                <Beer size={32} />
              </div>
              <div className="space-y-0.5">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">Order Request</p>
                <p className="text-xl font-black text-white">{selectedCocktail?.name}</p>
              </div>
            </div>
          </BottomSheet>
        </div>
        <Toast isVisible={!!toastMessage} message={toastMessage} onHide={() => setToastMessage('')} />
      </div>
    );
  }

  // ... (Bartender and Login views remain the same but included in the full file return)
  if (view === 'bartender' && session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center">
        <div className="w-full max-w-7xl flex flex-col min-h-screen pb-24">
          <header className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-zinc-950"><Wine size={18} /></div>
              <h1 className="text-lg font-black text-white tracking-tight">{session.eventCode}</h1>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowQrCode(true)} className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400">
                <QrCode size={18} />
              </button>
              <button onClick={refreshData} className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400">
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setSession(null)} className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400">
                <X size={18} />
              </button>
            </div>
          </header>

          {/* QR Code Modal */}
          {showQrCode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowQrCode(false)}>
              <div className="bg-white p-8 rounded-[32px] w-full max-w-sm flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="space-y-2 text-center">
                  <h3 className="text-2xl font-black text-zinc-950 uppercase italic tracking-tight">Join Session</h3>
                  <p className="text-zinc-500 font-medium">Scan to enter guest mode</p>
                </div>
                <div className="bg-white p-2 rounded-xl">
                  <QRCodeSVG
                    value={`${window.location.origin}?code=${session.eventCode}`}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="w-full bg-zinc-100 p-4 rounded-xl text-center">
                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Session Code</p>
                  <p className="text-3xl font-black text-zinc-950 tracking-widest">{session.eventCode}</p>
                </div>
                <Button onClick={() => setShowQrCode(false)} className="bg-zinc-950 text-white w-full h-14 rounded-2xl">
                  Done
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'ingredients' && (
              <div className="space-y-0">
                <div className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl p-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="text"
                      placeholder="Search inventory..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 h pl-11 pr-4 bg-zinc-900 rounded-xl border-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-amber-500/50 outline-none transition-all text-sm text-white"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setFilterUnavailableOnly(!filterUnavailableOnly)}
                      className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${filterUnavailableOnly ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}
                    >
                      Out Only
                    </button>
                    {INGREDIENT_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeCategories.includes(cat) ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {filteredIngredients.map((ing: string) => (
                    <div
                      key={ing}
                      onClick={() => toggleAvailability(ing)}
                      className={`flex items-center justify-between h-16 px-5 rounded-2xl transition-all border ${availability[ing] ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-900 border-zinc-800'}`}
                    >
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${availability[ing] ? 'text-red-500' : 'text-zinc-200'}`}>{ing}</span>
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter">{categorizeIngredient(ing)}</span>
                      </div>
                      <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${availability[ing] ? 'bg-zinc-800' : 'bg-green-600'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${availability[ing] ? 'translate-x-0' : 'translate-x-4'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="p-4 space-y-4 max-w-4xl mx-auto w-full">
                <div className="flex justify-between items-center px-1">
                  <h2 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Incoming Queue</h2>
                  <Badge variant="neutral">{orders.filter(o => o.status === 'pending').length}</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {orders.filter(o => o.status === 'pending').sort((a, b) => b.timestamp - a.timestamp).map(o => (
                    <div
                      key={o.id}
                      onClick={() => openRecipeForOrder(o)}
                      className="bg-zinc-900/50 p-5 rounded-[2rem] border border-zinc-800/50 flex flex-col gap-5 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:bg-zinc-900"
                    >
                      <div className="flex justify-between items-start pointer-events-none">
                        <div className="space-y-0.5">
                          <h3 className="text-lg font-black text-white leading-tight uppercase tracking-tight">{o.guestName}</h3>
                          <p className="text-amber-500 font-bold italic text-base leading-tight">{o.cocktailName}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-600">
                          <Clock size={12} strokeWidth={3} />
                          <span className="text-[10px] font-mono font-bold">{new Date(o.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateOrder(o.id, 'completed'); }}
                          className="flex-1 bg-white text-zinc-950 h-14 rounded-2xl font-black text-sm tracking-[0.1em] uppercase shadow-lg active:scale-95 transition-all"
                        >
                          NOTIFY READY
                        </button>
                        {o.guestPhone && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = `Hey ${o.guestName}! Your ${o.cocktailName} is ready at the bar! 🍸`;
                              window.open(`https://wa.me/${o.guestPhone}?text=${encodeURIComponent(text)}`, '_blank');
                            }}
                            className="w-14 h-14 bg-green-500 text-white rounded-2xl flex items-center justify-center border border-green-600 active:scale-90 transition-all shadow-lg shadow-green-500/20"
                          >
                            <MessageCircle size={24} fill="currentColor" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); updateOrder(o.id, 'deleted'); }}
                          className="w-14 h-14 bg-zinc-800/50 text-red-500/80 rounded-2xl flex items-center justify-center border border-zinc-700/50 active:scale-90 transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {orders.filter(o => o.status === 'pending').length === 0 && (
                    <div className="col-span-full py-24 text-center space-y-4">
                      <div className="w-16 h-16 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto text-zinc-800">
                        <Wine size={32} />
                      </div>
                      <p className="text-zinc-700 font-black uppercase text-[10px] tracking-[0.2em]">No pending orders</p>
                    </div>
                  )}
                </div>

                {orders.filter(o => o.status === 'completed').length > 0 && (
                  <div className="pt-8 space-y-3">
                    <h2 className="text-[10px] font-black text-zinc-800 uppercase tracking-widest px-1">Recent Activity</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 opacity-30">
                      {orders.filter(o => o.status === 'completed').sort((a, b) => b.timestamp - a.timestamp).slice(0, 6).map(o => (
                        <div key={o.id} className="bg-zinc-900/50 px-4 py-3 rounded-xl flex justify-between items-center border border-zinc-800">
                          <div className="flex flex-col">
                            <span className="text-white font-bold text-xs">{o.guestName}</span>
                            <span className="text-[10px] text-zinc-500">{o.cocktailName}</span>
                          </div>
                          <Check size={14} className="text-green-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'instructions' && (
              <div className="space-y-0">
                <div className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl p-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input
                      type="text"
                      placeholder="Search instructions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 pl-11 pr-4 bg-zinc-900 rounded-xl border-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-amber-500/50 outline-none transition-all text-sm text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1 flex overflow-x-auto gap-1.5 pb-2">
                        {SPIRITS_LIST.map(spirit => (
                          <button
                            key={spirit}
                            onClick={() => toggleRecipeSpirit(spirit)}
                            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeRecipeSpirits.includes(spirit) ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800'}`}
                          >
                            {spirit}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setBartenderViewMode(bartenderViewMode === 'grid' ? 'list' : 'grid')}
                        className="h-8 w-8 flex shrink-0 items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-400 active:scale-95 transition-all"
                      >
                        {bartenderViewMode === 'grid' ? <ListIcon size={14} /> : <LayoutGrid size={14} />}
                      </button>
                    </div>

                    {/* Taste Profiles Filter for Bartender */}
                    {allTasteProfiles.length > 0 && (
                      <div className="flex overflow-x-auto gap-1.5 pb-2 items-center pb-1">
                        <div className="flex items-center justify-center w-6 shrink-0 text-zinc-600">
                          <Tag size={12} />
                        </div>
                        {allTasteProfiles.map(profile => (
                          <button
                            key={profile}
                            onClick={() => toggleTasteProfile(profile)}
                            className={`shrink-0 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${activeTasteProfiles.includes(profile) ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}
                          >
                            {profile}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className={`p-4 ${bartenderViewMode === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3' : 'flex flex-col gap-2'}`}>
                  {filteredRecipes.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-zinc-600 text-xs font-black uppercase tracking-widest">
                      No recipes found
                    </div>
                  ) : filteredRecipes.map(c => {
                    const hasMissing = c.ingredients.some(ing => availability[ing]);

                    if (bartenderViewMode === 'grid') {
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCocktail(c)}
                          className={`group relative bg-zinc-900 rounded-2xl overflow-hidden shadow-lg active:scale-[0.96] transition-all flex flex-col ${hasMissing ? 'ring-1 ring-red-500/20' : ''}`}
                        >
                          <div className="aspect-square bg-zinc-800 relative overflow-hidden flex items-center justify-center">
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              className="w-full h-full object-cover object-bottom transition-transform duration-500 group-active:scale-110"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                              }}
                            />
                            <div className="fallback-icon hidden text-zinc-700">
                              <ImageIcon size={24} />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent"></div>
                            {hasMissing && (
                              <div className="absolute top-2 right-2">
                                <Badge variant="error">OUT</Badge>
                              </div>
                            )}
                          </div>
                          <div className="p-3 space-y-1 flex-1 flex flex-col justify-center">
                            <h3 className="text-xs font-black text-white leading-tight line-clamp-2">{c.name}</h3>
                            <p className="text-zinc-500 text-[8px] font-black uppercase truncate tracking-tighter">
                              {c.ingredients.filter(i => categorizeIngredient(i) === 'Spirit').join(', ') || 'House Mix'}
                            </p>
                            {/* Taste Profiles - Below Spirit */}
                            {c.tasteProfiles && c.tasteProfiles.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {c.tasteProfiles.slice(0, 3).map(p => (
                                  <span key={p} className="text-[8px] font-bold text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded-md tracking-wider">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCocktail(c)}
                          className={`group bg-zinc-900 p-2.5 rounded-2xl flex items-center gap-4 border transition-all active:scale-[0.98] ${hasMissing ? 'border-red-500/20' : 'border-zinc-800 hover:border-zinc-700'}`}
                        >
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-zinc-800 relative flex items-center justify-center shrink-0 shadow-lg">
                            <img
                              src={c.imageUrl}
                              className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                              }}
                            />
                            <div className="fallback-icon hidden text-zinc-700"><ImageIcon size={18} /></div>
                            {hasMissing && <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]"><X size={14} className="text-red-500" /></div>}
                          </div>
                          <div className="flex-1 min-w-0 py-1">
                            <h3 className="font-bold text-white text-sm truncate">{c.name}</h3>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <p className="text-zinc-500 text-[9px] font-black uppercase truncate tracking-widest">
                                {c.ingredients.filter(i => categorizeIngredient(i) === 'Spirit').join(', ') || 'House Selection'}
                              </p>
                              {c.tasteProfiles && c.tasteProfiles.length > 0 && (
                                <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">{c.tasteProfiles.join(', ')}</p>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-zinc-700 mr-2" />
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            )}
          </div>

          <BottomSheet
            isOpen={!!selectedCocktail}
            onClose={() => setSelectedCocktail(null)}
            title={selectedCocktail?.name || ''}
          >
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Build Components</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCocktail?.ingredients.filter(i => i.length > 1).map(ing => (
                    <div key={ing} className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${availability[ing] ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-zinc-800 border-zinc-700 text-zinc-100'}`}>
                      {availability[ing] ? <X size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} className="text-green-500" />}
                      <span>{ing}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Instructions</h4>
                <div className="p-5 bg-zinc-800/40 rounded-2xl border border-zinc-800">
                  <p className="text-sm text-zinc-300 leading-relaxed italic whitespace-pre-wrap">{selectedCocktail?.instructions}</p>
                </div>
              </div>
            </div>
          </BottomSheet>

          <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-2xl border-t border-zinc-800 safe-bottom z-40">
            <div className="flex justify-around items-center h-20 px-4 max-w-4xl mx-auto">
              <button onClick={() => setActiveTab('ingredients')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'ingredients' ? 'text-amber-500' : 'text-zinc-600'}`}>
                <ClipboardList size={22} strokeWidth={activeTab === 'ingredients' ? 3 : 2} />
                <span className="text-[8px] font-black uppercase tracking-[0.1em]">Stock</span>
              </button>
              <button onClick={() => setActiveTab('orders')} className={`relative flex flex-col items-center gap-1.5 transition-all ${activeTab === 'orders' ? 'text-amber-500' : 'text-zinc-600'}`}>
                <div className={`p-3.5 rounded-2xl transition-all -mt-12 shadow-xl ${activeTab === 'orders' ? 'bg-amber-500 text-zinc-950 rotate-3' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Wine size={24} />
                </div>
                <span className="text-[8px] font-black uppercase tracking-[0.1em] mt-1">Orders</span>
                {orders.filter(o => o.status === 'pending').length > 0 && (
                  <div className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-zinc-900 flex items-center justify-center -translate-y-2 translate-x-2">
                    {orders.filter(o => o.status === 'pending').length}
                  </div>
                )}
              </button>
              <button onClick={() => setActiveTab('instructions')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'instructions' ? 'text-amber-500' : 'text-zinc-600'}`}>
                <BookOpen size={22} strokeWidth={activeTab === 'instructions' ? 3 : 2} />
                <span className="text-[8px] font-black uppercase tracking-[0.1em]">Instructions</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    );
  }

  if (view === 'guest' && !session) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-md flex flex-col">
          <button onClick={() => setView('landing')} className="absolute top-8 left-8 p-3 text-zinc-500 bg-zinc-900 rounded-full">
            <X size={24} />
          </button>
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-white uppercase italic">Guest Entry</h2>
              <p className="text-zinc-500 text-lg">Enter details to start ordering.</p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              handleJoin('guest', (pendingSessionCode || fd.get('code') as string), fd.get('name') as string, guestPhoneInput);
            }} className="space-y-6">
              <div className="space-y-4">
                <input name="name" placeholder="Full Name" required autoFocus className="w-full h-18 px-6 bg-zinc-900 text-white rounded-2xl border-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-amber-500 text-xl" />

                <div className="w-full">
                  <PhoneInput
                    defaultCountry="us"
                    value={guestPhoneInput}
                    onChange={(phone) => setGuestPhoneInput(phone)}
                    inputClassName="!w-full !h-18 !bg-zinc-900 !text-white !text-xl !border-none !ring-0 focus:!ring-0 placeholder:!text-zinc-600 !pl-3"
                    className="rounded-2xl ring-1 ring-zinc-800 focus-within:ring-2 focus-within:ring-amber-500 bg-zinc-900 relative"
                    countrySelectorStyleProps={{
                      buttonClassName: '!bg-zinc-900 !border-none !h-18 !rounded-l-2xl !pl-4',
                      dropdownStyleProps: {
                        className: '!bg-zinc-900 !text-white !border-zinc-800 !rounded-xl !shadow-xl !z-50',
                        listItemClassName: 'hover:!bg-zinc-800 !text-white'
                      }
                    }}
                    style={{
                      '--react-international-phone-background-color': '#18181b',
                      '--react-international-phone-text-color': '#fff',
                      '--react-international-phone-border-color': 'transparent',
                      '--react-international-phone-height': '72px',
                      '--react-international-phone-font-size': '1.25rem',
                      '--react-international-phone-border-radius': '0',
                    } as React.CSSProperties}
                  />
                </div>

                {!pendingSessionCode && (
                  <input name="code" placeholder="Event Code" required className="w-full h-18 px-6 bg-zinc-900 text-white rounded-2xl border-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-amber-500 text-xl font-bold tracking-widest uppercase" />
                )}
                {pendingSessionCode && (
                  <div className="w-full h-18 px-6 bg-zinc-800/50 text-zinc-400 rounded-2xl flex items-center justify-between border border-zinc-800">
                    <span className="text-sm font-medium">Joining Session:</span>
                    <span className="text-xl font-black tracking-widest text-white">{pendingSessionCode}</span>
                  </div>
                )}
              </div>
              <Button type="submit" className="h-20 bg-amber-500 text-zinc-950 text-xl font-black uppercase">Enter Bar</Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'bartender' && !session) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-md">
          <button onClick={() => setView('landing')} className="absolute top-8 left-8 p-3 text-zinc-500 bg-zinc-900 rounded-full">
            <X size={24} />
          </button>
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-white uppercase italic">Bartender</h2>
              <p className="text-zinc-500 text-lg">Access inventory and order management.</p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const code = fd.get('code') as string;
              const password = fd.get('password') as string;

              if (password !== BARTENDER_PASSWORD) {
                showToast('Incorrect password');
                return;
              }
              handleJoin('bartender', code);
            }} className="space-y-4">
              <input name="code" placeholder="EVENT CODE" required autoFocus className="w-full h-20 px-6 bg-zinc-900 text-white rounded-3xl border-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-amber-500 text-2xl font-black tracking-[0.2em] text-center uppercase" />
              <div className="relative">
                <input name="password" type="password" placeholder="PASSWORD" required className="w-full h-20 px-6 bg-zinc-900 text-white rounded-3xl border-none ring-1 ring-zinc-800 focus:ring-2 focus:ring-amber-500 text-2xl font-black tracking-[0.2em] text-center uppercase" />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600">
                  <Lock size={24} />
                </div>
              </div>
              <Button type="submit" className="h-20 bg-white text-zinc-950 text-xl font-black uppercase">Login to Bar</Button>
            </form>
          </div>
        </div>
        <Toast isVisible={!!toastMessage} message={toastMessage} onHide={() => setToastMessage('')} />
      </div>
    );
  }

  return null;
};

export default App;
