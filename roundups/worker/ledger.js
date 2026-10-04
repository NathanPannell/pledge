import { DONATION_THRESHOLD } from './money.js';
export class Ledger {
  constructor(db) { this.db = db; }
  stmt(sql,...args) { return this.db.prepare(sql).bind(...args); }
  async state(userId) {
    const [balance, active, history] = await this.db.batch([
      this.stmt('SELECT COALESCE(SUM(CASE WHEN paid_at IS NULL THEN gift_cents ELSE 0 END),0) pending_cents, COALESCE(SUM(CASE WHEN paid_at IS NOT NULL THEN gift_cents ELSE 0 END),0) paid_cents FROM pledges WHERE user_id=?',userId),
      this.stmt("SELECT * FROM checkouts WHERE user_id=? AND status IN ('creating','open') LIMIT 1",userId),
      this.stmt('SELECT p.gift_cents,p.paid_at,q.provider,q.source,q.cad_cents FROM pledges p JOIN quotes q ON q.id=p.quote_id WHERE p.user_id=? ORDER BY p.created_at DESC LIMIT 12',userId),
    ]);
    return {...balance.results[0], active: active.results[0] ?? null, history:history.results, threshold_cents:DONATION_THRESHOLD};
  }
  async pledge(userId,quoteId,now) {
    const results = await this.db.batch([
      this.stmt('INSERT INTO pledges(id,quote_id,user_id,gift_cents,created_at) SELECT ?,id,user_id,gift_cents,? FROM quotes WHERE id=? AND user_id=? AND expires_at>? AND gift_cents>0 ON CONFLICT(quote_id) DO NOTHING',crypto.randomUUID(),now,quoteId,userId,now),
      this.stmt('SELECT * FROM pledges WHERE quote_id=? AND user_id=?',quoteId,userId),
    ]);
    const row=results[1].results[0];
    if(!row) throw Object.assign(new Error('This round-up expired. Refresh the amount and try again.'),{status:409});
    return {pledge:row,created:results[0].meta.changes===1,...await this.state(userId)};
  }
  async reserve(userId,now) {
    const id=crypto.randomUUID();
    const r=await this.db.batch([
      this.stmt("INSERT INTO checkouts(id,user_id,amount_cents,status,created_at) SELECT ?,?,SUM(gift_cents),'creating',? FROM pledges WHERE user_id=? AND paid_at IS NULL AND checkout_id IS NULL HAVING SUM(gift_cents)>=500 ON CONFLICT DO NOTHING",id,userId,now,userId),
      this.stmt('UPDATE pledges SET checkout_id=? WHERE user_id=? AND paid_at IS NULL AND checkout_id IS NULL AND EXISTS(SELECT 1 FROM checkouts WHERE id=?)',id,userId,id),
      this.stmt("SELECT * FROM checkouts WHERE user_id=? AND status IN ('creating','open')",userId),
    ]);
    if(!r[2].results[0]) throw Object.assign(new Error('Your pending round-ups need to reach C$5 first.'),{status:409});
    return r[2].results[0];
  }
  async attach(checkout,session) {
    await this.stmt("UPDATE checkouts SET stripe_session_id=?,stripe_url=?,status='open' WHERE id=? AND status IN ('creating','open') AND (stripe_session_id IS NULL OR stripe_session_id=?)",session.id,session.url,checkout.id,session.id).run();
    return this.stmt('SELECT * FROM checkouts WHERE id=?',checkout.id).first();
  }
  async settle(checkout,now,eventId) {
    // The database trigger checks the exact reserved sum and pays those rows atomically.
    await this.db.batch([
      this.stmt("UPDATE checkouts SET status='paid',paid_at=? WHERE id=? AND stripe_session_id=? AND status IN ('creating','open')",now,checkout.id,checkout.stripe_session_id),
      this.stmt('INSERT INTO payment_events(id,checkout_id,created_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING',eventId,checkout.id,now),
    ]);
  }
  async expire(checkout) {
    await this.db.batch([
      this.stmt("UPDATE checkouts SET status='expired' WHERE id=? AND status IN ('creating','open')",checkout.id),
      this.stmt("UPDATE pledges SET checkout_id=NULL WHERE checkout_id=? AND paid_at IS NULL AND EXISTS(SELECT 1 FROM checkouts WHERE id=? AND status='expired')",checkout.id,checkout.id),
    ]);
  }
}
