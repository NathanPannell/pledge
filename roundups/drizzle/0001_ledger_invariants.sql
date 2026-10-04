CREATE TRIGGER validate_payment BEFORE UPDATE OF status ON checkouts
WHEN NEW.status = 'paid' AND OLD.status != 'paid'
BEGIN
 SELECT CASE WHEN NEW.stripe_session_id IS NULL OR NEW.paid_at IS NULL OR
   (SELECT COALESCE(SUM(gift_cents),0) FROM pledges WHERE checkout_id=NEW.id AND paid_at IS NULL) != NEW.amount_cents
 THEN RAISE(ABORT, 'Reserved pledges do not match payment') END;
END;
--> statement-breakpoint
CREATE TRIGGER settle_pledges AFTER UPDATE OF status ON checkouts
WHEN NEW.status = 'paid' AND OLD.status != 'paid'
BEGIN
 UPDATE pledges SET paid_at=NEW.paid_at WHERE checkout_id=NEW.id AND paid_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER paid_checkout_immutable BEFORE UPDATE ON checkouts
WHEN OLD.status='paid' AND (NEW.status!='paid' OR NEW.amount_cents!=OLD.amount_cents OR NEW.user_id!=OLD.user_id OR NEW.stripe_session_id!=OLD.stripe_session_id)
BEGIN
 SELECT RAISE(ABORT, 'Paid checkouts are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER paid_pledge_immutable BEFORE UPDATE ON pledges
WHEN OLD.paid_at IS NOT NULL AND (NEW.paid_at IS NULL OR NEW.gift_cents!=OLD.gift_cents OR NEW.user_id!=OLD.user_id OR NEW.checkout_id!=OLD.checkout_id)
BEGIN
 SELECT RAISE(ABORT, 'Paid pledges are immutable');
END;
