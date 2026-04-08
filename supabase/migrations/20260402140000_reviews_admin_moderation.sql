-- Admins can moderate (delete) any review

DROP POLICY IF EXISTS "reviews_admin_delete" ON public.reviews;
CREATE POLICY "reviews_admin_delete"
ON public.reviews
FOR DELETE
TO authenticated
USING (public.is_admin());
