CREATE TRIGGER pledge_matches_quote BEFORE INSERT ON pledges
WHEN NOT EXISTS(SELECT 1 FROM quotes WHERE id=NEW.quote_id AND user_id=NEW.user_id AND gift_cents=NEW.gift_cents)
BEGIN
 SELECT RAISE(ABORT, 'Pledge must match its owner and quote');
END;
--> statement-breakpoint
CREATE TRIGGER reservation_owner BEFORE UPDATE OF checkout_id ON pledges
WHEN NEW.checkout_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM checkouts WHERE id=NEW.checkout_id AND user_id=NEW.user_id AND status IN ('creating','open','paid'))
BEGIN
 SELECT RAISE(ABORT, 'Checkout must belong to pledge owner');
END;
--> statement-breakpoint
CREATE TRIGGER quote_immutable BEFORE UPDATE ON quotes
BEGIN
 SELECT RAISE(ABORT, 'Approved quote cannot change');
END;
--> statement-breakpoint
CREATE TRIGGER cannot_delete_paid_pledge BEFORE DELETE ON pledges
WHEN OLD.paid_at IS NOT NULL
BEGIN
 SELECT RAISE(ABORT, 'Paid pledges cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER cannot_delete_paid_checkout BEFORE DELETE ON checkouts
WHEN OLD.status='paid'
BEGIN
 SELECT RAISE(ABORT, 'Paid checkouts cannot be deleted');
END;
