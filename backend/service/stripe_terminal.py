import stripe

from config import get_settings

stripe.api_key = get_settings().stripe_secret_key


def create_connection_token() -> str:
    token = stripe.terminal.ConnectionToken.create()
    return token.secret


def create_payment_intent(order_id: int, amount_cents: int) -> stripe.PaymentIntent:
    return stripe.PaymentIntent.create(
        amount=amount_cents,
        currency="usd",
        payment_method_types=["card_present"],
        capture_method="automatic",
        metadata={"order_id": str(order_id)},
    )
