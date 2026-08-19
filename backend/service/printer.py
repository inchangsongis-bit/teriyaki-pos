import logging

from escpos.printer import Network

from config import get_settings

logger = logging.getLogger(__name__)


def print_ticket(order) -> None:
    """Print a kitchen ticket for the given Order (with .items loaded).

    Printer hardware isn't guaranteed to be present in dev (e.g. running
    against the Stripe simulated reader with no physical kitchen printer
    on the LAN yet), so a connection failure is logged rather than raised
    -- it must not block the order from reaching PRINTED/the kitchen queue.
    """
    settings = get_settings()
    try:
        printer = Network(settings.printer_host, port=settings.printer_port, timeout=5)
    except Exception:
        logger.exception("Could not reach kitchen printer at %s:%s for order #%s",
                          settings.printer_host, settings.printer_port, order.id)
        return

    try:
        printer.set(align="center", bold=True, width=2, height=2)
        printer.text(f"ORDER #{order.id}\n")
        printer.set(align="left", bold=False, width=1, height=1)
        printer.text("-" * 32 + "\n")
        for item in order.items:
            printer.text(f"{item.qty}x {item.name_at_order}\n")
            if item.notes:
                printer.text(f"   note: {item.notes}\n")
        printer.text("-" * 32 + "\n")
        printer.text(f"Total: ${order.total_cents / 100:.2f}\n")
        printer.cut()
    except Exception:
        logger.exception("Print job failed for order #%s", order.id)
    finally:
        printer.close()
