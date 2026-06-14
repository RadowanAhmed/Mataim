-- Create a trigger for new order creation
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for restaurant
  INSERT INTO restaurant_notifications (
    restaurant_id,
    title,
    body,
    type,
    data,
    read,
    created_at
  ) VALUES (
    NEW.restaurant_id,
    '🆕 New Order Received!',
    'You have a new order #' || NEW.order_number || '. Tap to view details.',
    'order',
    jsonb_build_object(
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'status', NEW.status,
      'amount', NEW.final_amount,
      'timestamp', NOW()
    ),
    false,
    NOW()
  );
  
  -- Insert notification for customer
  INSERT INTO user_notifications (
    user_id,
    title,
    body,
    type,
    data,
    read,
    created_at
  ) VALUES (
    NEW.customer_id,
    '✅ Order Placed Successfully!',
    'Your order #' || NEW.order_number || ' has been placed successfully.',
    'order',
    jsonb_build_object(
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'status', NEW.status,
      'restaurant_id', NEW.restaurant_id,
      'amount', NEW.final_amount,
      'estimated_delivery', NEW.estimated_delivery_time,
      'timestamp', NOW()
    ),
    false,
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER order_created_notification
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_new_order();

-- Create function for status updates
CREATE OR REPLACE FUNCTION notify_order_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on status change
  IF OLD.status != NEW.status THEN
    -- Insert notification for customer
    INSERT INTO user_notifications (
      user_id,
      title,
      body,
      type,
      data,
      read,
      created_at
    ) VALUES (
      NEW.customer_id,
      '📦 Order Update',
      'Your order #' || NEW.order_number || ' status changed to: ' || NEW.status,
      'order',
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'timestamp', NOW()
      ),
      false,
      NOW()
    );
    
    -- Insert notification for restaurant
    INSERT INTO restaurant_notifications (
      restaurant_id,
      title,
      body,
      type,
      data,
      read,
      created_at
    ) VALUES (
      NEW.restaurant_id,
      '📦 Order Status Updated',
      'Order #' || NEW.order_number || ' status: ' || NEW.status,
      'order',
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'timestamp', NOW()
      ),
      false,
      NOW()
    );
    
    -- Notify driver if assigned and status is delivery related
    IF NEW.driver_id IS NOT NULL AND NEW.status IN ('out_for_delivery', 'delivered') THEN
      INSERT INTO driver_notifications (
        driver_id,
        title,
        body,
        type,
        data,
        read,
        created_at
      ) VALUES (
        NEW.driver_id,
        CASE 
          WHEN NEW.status = 'out_for_delivery' THEN '🚚 Delivery Started'
          ELSE '✅ Delivery Completed'
        END,
        CASE 
          WHEN NEW.status = 'out_for_delivery' 
            THEN 'Order #' || NEW.order_number || ' is now out for delivery'
            ELSE 'Order #' || NEW.order_number || ' has been delivered successfully'
        END,
        'order',
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'status', NEW.status,
          'timestamp', NOW()
        ),
        false,
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status updates
CREATE TRIGGER order_status_update_notification
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_order_status_update();