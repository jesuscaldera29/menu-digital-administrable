const url = 'https://zsguuroeboycudxdzmtm.supabase.co/rest/v1/products';
const key = 'sb_publishable_BQdnGotGMpJ5twOGgedUAw_1AAjmrlA';

const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };

(async () => {
    try {
        const res1 = await fetch(`${url}?select=*&order=id.desc`, { headers });
        const text1 = await res1.text();
        console.log('Query Status:', res1.status, text1.substring(0, 200));
    } catch (e) {
        console.error(e);
    }
})();
